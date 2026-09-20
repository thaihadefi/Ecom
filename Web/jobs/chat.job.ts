import cron from "node-cron";
import mongoose from "mongoose";
import ChatMessage from "../models/chat-message.model";
import ChatRoom from "../models/chat-room.model";
import { fmDeleteFolder } from "../helpers/file-manager.client";
import { invalidateRoomList, invalidateUserRoom, invalidateUnread, invalidateRoomStatus } from "../helpers/chat-cache.helper";

export const autoDeleteChatRoom = () => {
  cron.schedule("0 3 * * *", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const staleRooms = await ChatMessage.aggregate([
      { $group: { _id: "$roomId", lastMessageAt: { $max: "$createdAt" } } },
      { $match: { lastMessageAt: { $lt: tenDaysAgo } } }
    ]);

    if (staleRooms.length === 0) return;

    const roomIds = staleRooms
      .map(item => item._id)
      .filter(id => id && /^[0-9a-fA-F]{24}$/.test(id.toString()));

    const rooms = await ChatRoom.find({ _id: { $in: roomIds } }).select("_id userId adminId");

    rooms.forEach(room => fmDeleteFolder(`/media/chats/${room.userId}`));

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ChatMessage.deleteMany({ roomId: { $in: roomIds } }, { session });
        await ChatRoom.deleteMany({ _id: { $in: roomIds } }, { session });
      });
    } finally {
      session.endSession();
    }

    rooms.forEach(room => {
      if (room.adminId) invalidateRoomList(room.adminId);
      if (room.userId) invalidateUserRoom(room.userId);
      invalidateUnread(room._id.toString(), room.userId);
      invalidateRoomStatus(room._id.toString());
    });
  });
};
