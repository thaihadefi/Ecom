import mongoose from 'mongoose';
import FormData from 'form-data';
import axios from 'axios';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import AccountAdmin from '../../models/account-admin.model';
import { IChatRoom } from '../../interfaces/models/chat-room.interface';
import {
  invalidateRoomList,
  invalidateUnread,
  invalidateUserRoom,
  CK,
  warmCache,
} from '../../helpers/chat-cache.helper';
import { domainCDN } from '../../configs/variable.config';
import { IServerSendMessagePayload } from '../../interfaces/socket-events.interface';

interface ISocketAccount {
  id: string;
  role: string;
  roomId?: string;
}

export async function initChatRoom(
  account: ISocketAccount,
  listAdminOnline: Map<string, Set<string>>,
): Promise<IChatRoom | null> {
  if (account.role === 'user') return initUserRoom(account.id, listAdminOnline);
  if (account.role === 'admin') return initAdminRoom(account.id, account.roomId ?? '');
  return null;
}

async function initUserRoom(
  userId: string,
  listAdminOnline: Map<string, Set<string>>,
): Promise<IChatRoom | null> {
  const chatRoom = await ChatRoom.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, adminId: '', unreadCount: { user: 0, admin: 0 }, status: 'open' } },
    { new: true, upsert: true },
  );
  if (chatRoom && !chatRoom.adminId) return assignAdminToRoom(chatRoom, listAdminOnline);
  return chatRoom;
}

async function assignAdminToRoom(
  chatRoom: IChatRoom,
  listAdminOnline: Map<string, Set<string>>,
): Promise<IChatRoom | null> {
  const listIdAdminOnline = Array.from(listAdminOnline.keys());
  let selectedAdminId = '';

  if (listIdAdminOnline.length > 0) {
    const roomCounts = await ChatRoom.aggregate([
      { $match: { adminId: { $in: listIdAdminOnline } } },
      { $group: { _id: '$adminId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(roomCounts.map((r: { _id: string; count: number }) => [r._id, r.count]));
    selectedAdminId = listIdAdminOnline.reduce((minId, curId) => {
      const minCount = countMap.get(minId) || 0;
      const curCount = countMap.get(curId) || 0;
      return curCount < minCount ? curId : minId;
    }, listIdAdminOnline[0]);
  } else {
    const randomAdmin = await AccountAdmin.findOne().select('_id');
    if (randomAdmin) selectedAdminId = randomAdmin.id;
  }

  if (!selectedAdminId) return chatRoom;

  const updated = await ChatRoom.findByIdAndUpdate(chatRoom._id, { adminId: selectedAdminId }, { new: true });
  invalidateRoomList(selectedAdminId);
  return updated;
}

async function initAdminRoom(adminId: string, roomId: string): Promise<IChatRoom | null> {
  if (!roomId || !/^[0-9a-fA-F]{24}$/.test(roomId)) return null;
  const chatRoom = await ChatRoom.findOne({ _id: roomId }).select('adminId');
  if (!chatRoom || (chatRoom.adminId && chatRoom.adminId !== adminId)) {
    console.warn(`[Socket] Admin ${adminId} attempted to access room ${roomId} — denied`);
    return null;
  }
  return chatRoom;
}

export async function getRoomStatus(roomId: string): Promise<string> {
  const statusKey = CK.roomStatus(roomId);
  const cached = warmCache.get<string>(statusKey);
  if (cached !== undefined) return cached;
  const chatRoomDetail = await ChatRoom.findOne({ _id: roomId }).select('status');
  const status = chatRoomDetail?.status || 'open';
  warmCache.set(statusKey, status);
  return status;
}

export async function sendMessage(
  roomId: string,
  senderId: string,
  senderRole: string,
  content: string,
  files: string[],
): Promise<IServerSendMessagePayload> {
  const messageDoc = { roomId, senderId, senderRole, content, files };
  const newMessage = new ChatMessage(messageDoc);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await newMessage.save({ session });
      const unreadField = senderRole === 'user' ? 'unreadCount.admin' : 'unreadCount.user';
      await ChatRoom.updateOne({ _id: roomId }, { $inc: { [unreadField]: 1 } }, { session });
    });
  } finally {
    session.endSession();
  }

  invalidateUnread(roomId);
  return { _id: newMessage.id, ...messageDoc };
}

export async function markAdminRead(roomId: string): Promise<void> {
  await ChatRoom.updateOne({ _id: roomId }, { 'unreadCount.admin': 0 });
  invalidateUnread(roomId);
}

export async function markUserRead(roomId: string): Promise<void> {
  await ChatRoom.updateOne({ _id: roomId }, { 'unreadCount.user': 0 });
  invalidateUnread(roomId);
}

export async function deleteMessage(messageId: string, senderId: string): Promise<string> {
  const existMessage = await ChatMessage.findOne({ _id: messageId, senderId }).select('_id files');
  if (!existMessage) throw new Error('Message not found or unauthorized');

  if (existMessage.files && existMessage.files.length > 0) {
    for (const file of existMessage.files) {
      const lastSlash = file.lastIndexOf('/');
      const formData = new FormData();
      formData.append('folder', file.substring(0, lastSlash));
      formData.append('fileName', file.substring(lastSlash + 1));
      axios.patch(`${domainCDN}/file-manager/delete-file`, formData, {
        headers: { ...formData.getHeaders(), Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` },
      }).catch(() => {});
    }
  }

  await ChatMessage.deleteOne({ _id: messageId });
  return messageId;
}

export async function deleteRoom(roomId: string, adminId: string): Promise<{ userId: string }> {
  const existRoom = await ChatRoom.findOne({ _id: roomId, adminId }).select('_id userId');
  if (!existRoom) throw new Error('Room not found or unauthorized');

  const formData = new FormData();
  formData.append('folderPath', `/media/chats/${existRoom.userId}`);
  axios.patch(`${domainCDN}/file-manager/folder/delete`, formData, {
    headers: { ...formData.getHeaders(), Authorization: `Bearer ${process.env.FILE_MANAGER_SECRET}` },
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

  invalidateRoomList(adminId);
  invalidateUserRoom(existRoom.userId ?? '');
  return { userId: existRoom.userId ?? '' };
}
