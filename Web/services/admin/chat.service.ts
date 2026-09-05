import ChatRoom from '../../models/chat-room.model';
import AccountUser from '../../models/account-user.model';
import ChatMessage from '../../models/chat-message.model';
import { getChatRoomList, invalidateRoomList } from '../../helpers/chat.helper';
import { timeAgo } from '../../helpers/format.helper';
import { aiGenerateAnswer } from '../../helpers/ai.helper';
import { fmUpload } from '../../helpers/file-manager.client';
import { invalidateRoomStatus } from '../../helpers/chat-cache.helper';
import { getIO } from '../../sockets/index.socket';

export const getAdminChatList = async (adminId: string) => {
  return getChatRoomList(adminId);
};

export const getAdminChatDetail = async (roomId: string, adminId: string) => {
  const chatRoomDetail = await ChatRoom.findOne({ _id: roomId });
  if (!chatRoomDetail) {
    return null;
  }

  const infoUser = await AccountUser.findOne({
    _id: chatRoomDetail.userId
  }).select("_id fullName avatar");

  if (!infoUser) {
    return null;
  }

  await ChatRoom.updateOne({ _id: roomId }, { "unreadCount.admin": 0 });
  invalidateRoomList(adminId);

  const chatRoomList = await getChatRoomList(adminId);

  return {
    chatRoomList,
    chatRoomDetail,
    infoUser
  };
};

export const getAdminMessages = async (roomId: string, limit = 20, lastMessageId?: unknown) => {
  const cappedLimit = Math.min(Math.max(limit || 20, 1), 100);
  const chatRoom = await ChatRoom.findOne({ _id: roomId });
  if (!chatRoom) {
    return null;
  }

  const find: Record<string, unknown> = {
    roomId: chatRoom.id
  };

  if (lastMessageId) {
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

export const uploadAdminChatFiles = async (roomId: string, files: Express.Multer.File[]) => {
  const chatRoomDetail = await ChatRoom.findOne({ _id: roomId });
  if (!chatRoomDetail) {
    return { success: false, message: "Chat room not found!" };
  }

  const upload = await fmUpload(files, `chats/${chatRoomDetail.userId}`);
  if (!upload.success) {
    return { success: false, message: "Upload error!" };
  }

  return {
    success: true,
    message: "Uploaded successfully!",
    fileUrls: upload.fileUrls
  };
};

export const changeChatRoomStatus = async (roomId: string, status: string) => {
  const chatRoomDetail = await ChatRoom.findOne({ _id: roomId });
  if (!chatRoomDetail) {
    return { success: false, message: "Chat room not found!" };
  }

  await ChatRoom.updateOne({ _id: roomId }, { status });

  
  invalidateRoomStatus(roomId);
  getIO()?.to(roomId).emit("SERVER_ROOM_STATUS", { roomId, status });

  return { success: true, message: "Status changed successfully!" };
};

export const getAdminChatRating = async (roomId: string, adminId: string) => {
  const chatRoomDetail = await ChatRoom.findOne({ _id: roomId });
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

const getRecentConversationText = async (roomId: string, limit = 10) => {
  const messages = await ChatMessage.find({ roomId })
    .sort({ createdAt: "desc" })
    .limit(limit);

  return messages
    .reverse()
    .map(item => `${item.senderRole === "user" ? "Customer" : "Admin"}: ${item.content}`)
    .join("\n");
};

export const suggestAdminReply = async (roomId: string) => {
  const conversation = await getRecentConversationText(roomId, 10);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please suggest 3 short, polite responses for the admin to reply to the customer.
    Write in English.
  `;

  return aiGenerateAnswer(prompt);
};

export const editAdminReply = async (roomId: string, draftContent: string) => {
  const conversation = await getRecentConversationText(roomId, 10);
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

export const summarizeAdminChat = async (roomId: string) => {
  const conversation = await getRecentConversationText(roomId, 10);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please summarize the conversation between the customer and the admin to be very short and concise.
  `;

  return aiGenerateAnswer(prompt);
};

export const analyzeAdminChatEmotions = async (roomId: string) => {
  const conversation = await getRecentConversationText(roomId, 20);
  const prompt = `
    You are a customer service assistant.

    Here is the conversation between the customer and the admin:

    ${conversation}

    Please analyze the conversation between the customer and the admin in detail, then analyze the customer's emotions. Feedback on how the customer's emotions are currently, and whether this customer is potential or not.
  `;

  return aiGenerateAnswer(prompt);
};
