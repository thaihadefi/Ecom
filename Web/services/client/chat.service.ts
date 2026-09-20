import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import { fmUpload } from '../../helpers/file-manager.client';
import { hotCache, CK } from '../../helpers/chat-cache.helper';
import { upstreamStatus } from "../../helpers/http-response.helper";

export const getMessagesByUserId = async (
  userId: string,
  rawLimit?: unknown,
  lastMessageId?: string
) => {
  const chatRoom = await ChatRoom.findOne({ userId });
  if (!chatRoom) return null;

  const limit = Math.min(Math.max(parseInt(`${rawLimit ?? 20}`) || 20, 1), 100);
  const find: Record<string, unknown> = {
    roomId: chatRoom.id
  };

  if (lastMessageId) {
    find._id = { $lt: lastMessageId };
  }

  const chatMessages = await ChatMessage
    .find(find)
    .sort({ createdAt: "desc" })
    .limit(limit);

  for (const item of chatMessages) {
    item.createdAtFormat = timeAgo(item.createdAt);
  }

  return {
    messages: lastMessageId ? chatMessages : chatMessages.reverse(),
    adminUnreadCount: chatRoom.unreadCount?.admin ?? 0,
    roomStatus: chatRoom.status ?? "open"
  };
};

export const uploadChatFiles = async (userId: string, files: Express.Multer.File[]) => {
  const chatRoomDetail = await ChatRoom.findOne({ userId });
  if (chatRoomDetail?.status === "locked") {
    return { success: false, status: 409, message: "Chat room is locked!" };
  }

  const upload = await fmUpload(files, `chats/${userId}`);
  if (!upload.success) {
    return { success: false, status: upstreamStatus(upload.status), message: upload.message || "Upload error!" };
  }

  return {
    success: true,
    fileUrls: upload.fileUrls
  };
};

export const rateChatRoom = async (userId: string, rawStars: unknown, rawComment?: unknown) => {
  const stars = Number(rawStars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { success: false, status: 400, message: "Please choose a rating from 1 to 5 stars!" };
  }
  const comment = typeof rawComment === "string" ? rawComment.trim().slice(0, 500) : undefined;

  const chatRoom = await ChatRoom.findOne({
    userId: userId,
    status: "open"
  });

  if (!chatRoom) {
    return { success: false, status: 404, message: "Chat room not found!" };
  }

  await ChatRoom.updateOne(
    { _id: chatRoom.id },
    {
      $push: {
        rating: {
          stars: stars,
          comment: comment,
          ratedAt: new Date()
        }
      }
    }
  );

  return { success: true, message: "Thank you for your rating!" };
};

export const getUserUnreadCount = async (userId: string): Promise<number> => {
  const cacheKey = CK.unreadUser(userId);
  const cached = hotCache.get<number>(cacheKey);
  if (cached !== undefined) return cached;

  const chatRoom = await ChatRoom.findOne({ userId }).select("unreadCount");
  const count = chatRoom?.unreadCount?.user ?? 0;
  hotCache.set(cacheKey, count, 30);
  return count;
};

