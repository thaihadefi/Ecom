import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import { timeAgo } from '../../helpers/format.helper';
import { fmUpload } from '../../helpers/file-manager.client';

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
    return { success: false, message: "Chat room is locked!" };
  }

  const upload = await fmUpload(files, `chats/${userId}`);
  if (!upload.success) {
    return { success: false, message: "Upload error!" };
  }

  return {
    success: true,
    fileUrls: upload.fileUrls
  };
};

export const rateChatRoom = async (userId: string, stars: number, comment?: string) => {
  const chatRoom = await ChatRoom.findOne({
    userId: userId,
    status: "open"
  });

  if (!chatRoom) {
    return { success: false, message: "Chat room not found!" };
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
  const chatRoom = await ChatRoom.findOne({ userId }).select("unreadCount");
  return chatRoom?.unreadCount?.user ?? 0;
};
