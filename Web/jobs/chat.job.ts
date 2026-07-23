import cron from "node-cron";
import mongoose from "mongoose";
import ChatMessage from "../models/chat-message.model";
import ChatRoom from "../models/chat-room.model";
import axios from "axios";
import { domainCDN } from "../configs/variable.config";
import FormData from 'form-data';

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

    // Fetch all rooms in one query
    const rooms = await ChatRoom.find({ _id: { $in: roomIds } }).select("_id userId");

    // Fire-and-forget CDN folder deletes in parallel
    await Promise.allSettled(rooms.map(room => {
      const formData = new FormData();
      formData.append("folderPath", `/media/chats/${room.userId}`);
      return axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
        headers: { ...formData.getHeaders(), Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` }
      });
    }));

    // Batch delete messages and rooms atomically
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ChatMessage.deleteMany({ roomId: { $in: roomIds } }, { session });
        await ChatRoom.deleteMany({ _id: { $in: roomIds } }, { session });
      });
    } finally {
      session.endSession();
    }
  });
}
