import AccountUser from "../models/account-user.model";
import ChatMessage from "../models/chat-message.model";
import ChatRoom from "../models/chat-room.model";
import { timeAgo } from "./format.helper";
import { warmCache, CK, invalidateRoomList } from "./chat-cache.helper";

export const getChatRoomList = async (adminId: string) => {
  const cacheKey = CK.roomList(adminId);
  const cached = warmCache.get<unknown[]>(cacheKey);
  if (cached) return cached;

  const chatRoomList = await ChatRoom.find({ adminId });

  const userIds = [...new Set(chatRoomList.map(r => String(r.userId)).filter((id): id is string => Boolean(id) && id !== "undefined"))];
  const roomIds = chatRoomList.map(r => r._id.toString());

  const [users, lastMessages] = await Promise.all([
    AccountUser.find({ _id: { $in: userIds } }).select("fullName avatar"),
    ChatMessage.aggregate([
      { $match: { roomId: { $in: roomIds } } },
      { $sort:  { createdAt: -1 } },
      { $group: { _id: "$roomId", doc: { $first: "$$ROOT" } } }
    ])
  ]);

  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));
  const lastMessageMap = Object.fromEntries(lastMessages.map(l => [l._id, l.doc]));

  const result = chatRoomList.map(item => {
    const rid = item._id.toString();
    const user = item.userId ? userMap[item.userId] : undefined;
    const last = lastMessageMap[rid];
    return {
      ...item.toObject(),
      id: rid,
      infoUser: { fullName: user?.fullName, avatar: user?.avatar },
      lastMessage: last
        ? { ...last, createdAtFormat: timeAgo(last.createdAt) }
        : null
    };
  });

  warmCache.set(cacheKey, result);
  return result;
};

export { invalidateRoomList };
