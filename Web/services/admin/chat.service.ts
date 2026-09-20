import mongoose from 'mongoose';
import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { getChatRoomList, invalidateRoomList } from '../../helpers/chat.helper';
import { timeAgo } from '../../helpers/format.helper';
import { aiGenerateAnswer } from '../../helpers/ai.helper';
import { fmUpload } from '../../helpers/file-manager.client';
import { invalidateRoomStatus } from '../../helpers/chat-cache.helper';
import { getIO } from '../../sockets/index.socket';
import { upstreamStatus } from "../../helpers/http-response.helper";

export interface ChatActor {
  id: string;
  isSuperAdmin?: boolean;
}

const findAccessibleRoom = async (roomId: string, actor: ChatActor) => {
  if (!mongoose.isValidObjectId(roomId)) return null;
  const room = await ChatRoom.findOne({ _id: roomId });
  if (!room) return null;
  if (!actor.isSuperAdmin && room.adminId && room.adminId !== actor.id) return null;
  return room;
};

export const getAdminChatList = async (adminId: string) => {
  return getChatRoomList(adminId);
};

export const getAdminChatDetail = async (roomId: string, actor: ChatActor) => {
  const adminId = actor.id;
  const chatRoomDetail = await findAccessibleRoom(roomId, actor);
  if (!chatRoomDetail) {
    return null;
  }

  const infoUser = await AccountUser.findOne({
    _id: chatRoomDetail.userId
  }).select("_id fullName avatar");

  if (!infoUser) {
    return null;
  }

  // The socket marks the room as read as soon as the admin connects to it (ADMIN_OPEN_CHAT); this page only has to show it as read.
  type ListedRoom = { id?: string; unreadCount?: { admin?: number } };
  const chatRoomList = ((await getChatRoomList(adminId)) as ListedRoom[]).map((room) =>
    room.id === String(roomId) ? { ...room, unreadCount: { ...room.unreadCount, admin: 0 } } : room
  );

  return {
    chatRoomList,
    chatRoomDetail,
    infoUser
  };
};

export const getAdminMessages = async (roomId: string, actor: ChatActor, limit = 20, lastMessageId?: unknown) => {
  const cappedLimit = Math.min(Math.max(limit || 20, 1), 100);
  const chatRoom = await findAccessibleRoom(roomId, actor);
  if (!chatRoom) {
    return null;
  }

  const find: Record<string, unknown> = {
    roomId: chatRoom.id
  };

  if (lastMessageId && mongoose.isValidObjectId(lastMessageId)) {
    find._id = {
      $lt: lastMessageId
    };
  }

  const chatMessages = await ChatMessage
    .find(find)
    .sort({ createdAt: "desc" })
    .limit(cappedLimit);

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }

  return {
    messages: lastMessageId ? chatMessages : chatMessages.reverse(),
    userUnreadCount: chatRoom.unreadCount?.user ?? 0
  };
};

export const uploadAdminChatFiles = async (roomId: string, actor: ChatActor, files: Express.Multer.File[]) => {
  const chatRoomDetail = await findAccessibleRoom(roomId, actor);
  if (!chatRoomDetail) {
    return { success: false, status: 404, message: "Chat room not found!" };
  }

  const upload = await fmUpload(files, `chats/${chatRoomDetail.userId}`);
  if (!upload.success) {
    return { success: false, status: upstreamStatus(upload.status), message: upload.message || "Upload error!" };
  }

  return {
    success: true,
    message: "Uploaded successfully!",
    fileUrls: upload.fileUrls
  };
};

export const changeChatRoomStatus = async (roomId: string, actor: ChatActor, status: string) => {
  if (status !== "open" && status !== "locked") {
    return { success: false, status: 400, message: "Invalid status!" };
  }
  const chatRoomDetail = await findAccessibleRoom(roomId, actor);
  if (!chatRoomDetail) {
    return { success: false, status: 404, message: "Chat room not found!" };
  }

  await ChatRoom.updateOne({ _id: roomId }, { status });

  
  invalidateRoomStatus(roomId);
  if (chatRoomDetail.adminId) {
    invalidateRoomList(chatRoomDetail.adminId);
  }
  getIO()?.to(roomId).emit("SERVER_ROOM_STATUS", { roomId, status });

  return { success: true, message: "Status changed successfully!" };
};

export const getAdminChatRating = async (roomId: string, actor: ChatActor) => {
  const adminId = actor.id;
  const chatRoomDetail = await findAccessibleRoom(roomId, actor);
  if (!chatRoomDetail) {
    return null;
  }

  const ratingList = chatRoomDetail.rating.reverse();
  const chatRoomList = await getChatRoomList(adminId);

  return {
    chatRoomList,
    chatRoomDetail,
    ratingList
  };
};

const getRecentConversationText = async (roomId: string, actor: ChatActor, limit = 10) => {
  const room = await findAccessibleRoom(roomId, actor);
  if (!room) throw new Error("Chat room not found!");
  const messages = await ChatMessage.find({ roomId })
    .sort({ createdAt: "desc" })
    .limit(limit);

  return messages
    .reverse()
    .map(item => `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`)
    .join("\n");
};

export const suggestAdminReply = async (roomId: string, actor: ChatActor) => {
  const conversation = await getRecentConversationText(roomId, actor, 10);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please suggest 3 short, polite responses for the admin to reply to the customer.
    Write in English.
  `;

  return aiGenerateAnswer(prompt);
};

export const editAdminReply = async (roomId: string, actor: ChatActor, rawDraft: unknown) => {
  const draftContent = String(rawDraft ?? "").slice(0, 2000);
  const conversation = await getRecentConversationText(roomId, actor, 10);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Here is the reply the admin is drafting: ${draftContent}

    Please edit the admin's draft and suggest 3 better alternative responses.
    Write in English.
  `;

  return aiGenerateAnswer(prompt);
};

export const summarizeAdminChat = async (roomId: string, actor: ChatActor) => {
  const conversation = await getRecentConversationText(roomId, actor, 10);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please summarize the conversation between the customer and the admin to be very short and concise.
  `;

  return aiGenerateAnswer(prompt);
};

export const analyzeAdminChatEmotions = async (roomId: string, actor: ChatActor) => {
  const conversation = await getRecentConversationText(roomId, actor, 20);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please analyze the conversation between the customer and the admin in detail, then analyze the customer's emotions. Feedback on how the customer's emotions are currently, and whether this customer is potential or not.
  `;

  return aiGenerateAnswer(prompt);
};
