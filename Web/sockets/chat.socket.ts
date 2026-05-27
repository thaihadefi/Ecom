import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import ChatRoom from "../models/chat-room.model";
import ChatMessage from "../models/chat-message.model";
import AccountAdmin from "../models/account-admin.model";
import axios from "axios";
import { domainCDN } from "../configs/variable.config";
import FormData from 'form-data';
import { invalidateRoomList, invalidateUnread, invalidateUserRoom, CK, warmCache } from "../helpers/chat-cache.helper";

export const chatSocket = async (io: Server, socket: Socket, listAdminOnline: any) => {
  const account = socket.data.account;
  if (!account) return;

  let chatRoom: any = null;

  if (account.role === 'user') {
    // Atomic upsert — prevents duplicate rooms on concurrent connects
    chatRoom = await ChatRoom.findOneAndUpdate(
      { userId: account.id },
      { $setOnInsert: { userId: account.id, adminId: "", unreadCount: { user: 0, admin: 0 }, status: 'open' } },
      { new: true, upsert: true }
    );

    // If newly created room (no adminId), assign admin
    if (!chatRoom.adminId) {
      const listIdAdminOnline = Array.from(listAdminOnline.keys()) as string[];
      let selectedAdminId = "";

      if (listIdAdminOnline.length > 0) {
        const counts = await Promise.all(
          listIdAdminOnline.map(id => ChatRoom.countDocuments({ adminId: id }).then(c => ({ id, c })))
        );
        selectedAdminId = counts.reduce((min, cur) => cur.c < min.c ? cur : min).id;
      } else {
        const randomAdmin = await AccountAdmin.findOne().select("_id");
        if (randomAdmin) selectedAdminId = randomAdmin.id;
      }

      if (selectedAdminId) {
        chatRoom = await ChatRoom.findByIdAndUpdate(
          chatRoom._id,
          { adminId: selectedAdminId },
          { new: true }
        );
        invalidateRoomList(selectedAdminId);
      }
    }

  } else if (account.role === 'admin') {
    if (!account.roomId || !/^[0-9a-fA-F]{24}$/.test(account.roomId)) return;

    chatRoom = await ChatRoom.findOne({ _id: account.roomId }).select("adminId");

    // Authorization: only the assigned admin (or if no admin assigned) can enter
    if (!chatRoom || (chatRoom.adminId && chatRoom.adminId !== account.id)) {
      console.warn(`[Socket] Admin ${account.id} attempted to access room ${account.roomId} — denied`);
      return;
    }
  }

  if (!chatRoom) {
    console.warn(`[Socket] chatRoom not found for account: ${account.id} (${account.role})`);
    return;
  }

  socket.join(chatRoom.id);

  // Admin opens chat → reset unread
  if (account.role === 'admin') {
    await ChatRoom.updateOne({ _id: chatRoom.id }, { 'unreadCount.admin': 0 });
    invalidateUnread(chatRoom.id);
    socket.to(chatRoom.id).emit('SERVER_ADMIN_READ');
  }

  socket.on('ADMIN_OPEN_CHAT', async (data) => {
    if (account.role !== 'admin') return;
    if (data?.roomId && data.roomId !== chatRoom.id) return;
    if (data?.isOpen === false) return;
    await ChatRoom.updateOne({ _id: chatRoom.id }, { 'unreadCount.admin': 0 });
    invalidateUnread(chatRoom.id);
    socket.to(chatRoom.id).emit('SERVER_ADMIN_READ');
  });

  socket.on('CLIENT_SEND_MESSAGE', async (data) => {
    try {
      // Cache-first room lock check (avoids DB query per message)
      const statusKey = CK.roomStatus(chatRoom.id);
      let roomStatus = warmCache.get<string>(statusKey);
      if (roomStatus === undefined) {
        const chatRoomDetail = await ChatRoom.findOne({ _id: chatRoom.id }).select("status");
        roomStatus = chatRoomDetail?.status || "open";
        warmCache.set(statusKey, roomStatus);
      }
      if (roomStatus === 'locked') {
        socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Chat room is locked!' });
        return;
      }

      const message = {
        roomId:     chatRoom.id,
        senderId:   account.id,
        senderRole: account.role,
        content:    data.content,
        files:      data.files ?? [],
      };
      const newMessage = new ChatMessage(message);
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await newMessage.save({ session });

          if (account.role === 'user') {
            await ChatRoom.updateOne({ _id: chatRoom.id }, { $inc: { 'unreadCount.admin': 1 } }, { session });
          } else {
            await ChatRoom.updateOne({ _id: chatRoom.id }, { $inc: { 'unreadCount.user': 1 } }, { session });
          }
        });
      } finally {
        session.endSession();
      }
      invalidateUnread(chatRoom.id);
      invalidateRoomList(chatRoom.adminId ?? "");

      io.to(chatRoom.id).emit('SERVER_SEND_MESSAGE', { _id: newMessage.id, ...message });

      const roomSockets   = await io.in(chatRoom.id).fetchSockets();
      const recipientRole = account.role === 'admin' ? 'user' : 'admin';
      if (roomSockets.some((s: any) => s.data.account?.role === recipientRole)) {
        socket.emit('SERVER_MESSAGE_DELIVERED', { messageId: newMessage.id });
      }
    } catch (err: any) {
      console.error('[Socket] CLIENT_SEND_MESSAGE error:', err.message);
      socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Failed to send message.' });
    }
  });

  // Fix: use socket.to to exclude sender (and other admins in room)
  socket.on("ADMIN_TYPING", (data) => {
    socket.to(chatRoom.id).emit("SERVER_SEND_ADMIN_TYPING", data);
  });

  socket.on('CLIENT_OPEN_CHAT', async (data) => {
    if (data.isOpen) {
      await ChatRoom.updateOne({ _id: chatRoom.id }, { 'unreadCount.user': 0 });
      invalidateUnread(chatRoom.id);
      socket.to(chatRoom.id).emit('SERVER_CLIENT_READ');
    }
  });

  socket.on('CLIENT_DELETE_MESSAGE', async (data) => {
    try {
      const { messageId } = data;
      const existMessage = await ChatMessage.findOne({ _id: messageId, senderId: account.id }).select("_id files");
      if (!existMessage) return;

      if (existMessage.files.length > 0) {
        for (const file of existMessage.files) {
          const lastSlash = file.lastIndexOf("/");
          const formDataDelete = new FormData();
          formDataDelete.append("folder",   file.substring(0, lastSlash));
          formDataDelete.append("fileName", file.substring(lastSlash + 1));
          axios.patch(`${domainCDN}/file-manager/delete-file`, formDataDelete, {
            headers: { ...formDataDelete.getHeaders(), Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` }
          }).catch(() => {});
        }
      }

      await ChatMessage.deleteOne({ _id: messageId });
      invalidateRoomList(chatRoom.adminId ?? "");
      io.to(chatRoom.id).emit('SERVER_DELETE_MESSAGE', { messageId });
    } catch (err: any) {
      console.error('[Socket] CLIENT_DELETE_MESSAGE error:', err.message);
    }
  });

  socket.on('ADMIN_DELETE_ROOM', async (data) => {
    try {
      const { roomId } = data;
      const existRoom = await ChatRoom.findOne({ _id: roomId, adminId: account.id }).select("_id userId");
      if (!existRoom) return;

      const formData = new FormData();
      formData.append("folderPath", `/media/chats/${existRoom.userId}`);
      axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
        headers: { ...formData.getHeaders(), Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` }
      }).catch(() => {});

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await ChatMessage.deleteMany({ roomId }, { session });
          await ChatRoom.deleteOne({ _id: roomId }, { session });
        });
      } finally {
        session.endSession();
      }

      invalidateRoomList(account.id);
      invalidateUserRoom(existRoom.userId ?? "");

      io.to(chatRoom.id).emit('SERVER_DELETE_ROOM', { roomId });
    } catch (err: any) {
      console.error('[Socket] ADMIN_DELETE_ROOM error:', err.message);
    }
  });
};
