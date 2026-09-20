import mongoose from 'mongoose';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import AccountAdmin from '../../models/account-admin.model';
import { filterAdminIdsWithPermission } from '../admin/auth.service';
import { IChatRoom } from '../../interfaces/models/chat-room.interface';
import { IChatMessage } from '../../interfaces/models/chat-message.interface';
import {
  invalidateRoomList,
  invalidateUnread,
  invalidateUserRoom,
  invalidateRoomStatus,
  CK,
  warmCache,
} from '../../helpers/chat-cache.helper';
import { fmDeleteByLink, fmDeleteFolder } from '../../helpers/file-manager.client';
import { IServerSendMessagePayload } from '../../interfaces/socket-events.interface';
import type { Server } from 'socket.io';

interface ISocketAccount {
  id: string;
  role: string;
  roomId?: string;
}

const ADMINS_ROOM = 'admins';

const TXN_UNSUPPORTED = /Transaction numbers are only allowed|replica set|Transactions? (are|is) not supported|does not support transactions|Sessions are not supported/i;

let transactionsUnsupported = false;

async function runAtomically(
  work: (session?: mongoose.ClientSession) => Promise<void>,
): Promise<void> {
  if (!transactionsUnsupported) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => { await work(session); });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: number }).code;
      if (code !== 20 && !TXN_UNSUPPORTED.test(msg)) throw err;
      transactionsUnsupported = true;
      console.warn('[Socket] MongoDB has no transaction support - chat writes fall back to non-atomic mode.');
    } finally {
      session.endSession();
    }
  }
  await work();
}

export async function initChatRoom(
  account: ISocketAccount,
  listAdminOnline: Map<string, Set<string>>,
  io: Server,
): Promise<IChatRoom | null> {
  if (account.role === 'user') return initUserRoom(account.id, listAdminOnline, io);
  if (account.role === 'admin') return initAdminRoom(account.id, account.roomId ?? '');
  return null;
}

const isAssignableAdmin = async (adminId: string): Promise<boolean> =>
  (await filterAdminIdsWithPermission([adminId], 'chat-reply')).length > 0;

async function initUserRoom(
  userId: string,
  listAdminOnline: Map<string, Set<string>>,
  io: Server,
): Promise<IChatRoom | null> {
  const chatRoom = await ChatRoom.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, adminId: '', unreadCount: { user: 0, admin: 0 }, status: 'open' } },
    { new: true, upsert: true },
  );
  if (!chatRoom) return null;
  
  if (!chatRoom.adminId || !(await isAssignableAdmin(chatRoom.adminId))) {
    return assignAdminToRoom(chatRoom, listAdminOnline, io);
  }
  return chatRoom;
}

async function assignAdminToRoom(
  chatRoom: IChatRoom,
  listAdminOnline: Map<string, Set<string>>,
  io: Server,
): Promise<IChatRoom | null> {
  const listIdAdminOnline = Array.from(listAdminOnline.keys());
  let selectedAdminId = '';

  
  const activeOnline = await filterAdminIdsWithPermission(listIdAdminOnline, 'chat-reply');

  if (activeOnline.length > 0) {
    const roomCounts = await ChatRoom.aggregate([
      { $match: { adminId: { $in: activeOnline } } },
      { $group: { _id: '$adminId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(roomCounts.map((r: { _id: string; count: number }) => [r._id, r.count]));
    selectedAdminId = activeOnline.reduce((minId, curId) => {
      const minCount = countMap.get(minId) || 0;
      const curCount = countMap.get(curId) || 0;
      return curCount < minCount ? curId : minId;
    }, activeOnline[0]);
  } else {
    const candidates = (await AccountAdmin.find({ deleted: false, status: 'active' }).select('_id').limit(50)).map(a => String(a._id));
    const [fallbackAdminId] = await filterAdminIdsWithPermission(candidates, 'chat-reply');
    if (fallbackAdminId) selectedAdminId = fallbackAdminId;
  }

  if (!selectedAdminId) return chatRoom;

  
  const previousAdminId = chatRoom.adminId || '';
  const updated = await ChatRoom.findOneAndUpdate(
    { _id: chatRoom._id, adminId: previousAdminId },
    { adminId: selectedAdminId },
    { new: true },
  );
  if (!updated) return ChatRoom.findById(chatRoom._id);
  invalidateRoomList(selectedAdminId);
  if (previousAdminId) {
    invalidateRoomList(previousAdminId);
    
    io.to(ADMINS_ROOM).emit('SERVER_ROOM_ASSIGNED', { roomId: String(updated._id), adminId: selectedAdminId });
  }
  return updated;
}

async function initAdminRoom(adminId: string, roomId: string): Promise<IChatRoom | null> {
  if (!roomId || !/^[0-9a-fA-F]{24}$/.test(roomId)) return null;
  const chatRoom = await ChatRoom.findOne({ _id: roomId }).select('adminId userId');
  if (!chatRoom || (chatRoom.adminId && chatRoom.adminId !== adminId)) {
    console.warn(`[Socket] Admin ${adminId} attempted to access room ${roomId} - denied`);
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
  const unreadField = senderRole === 'user' ? 'unreadCount.admin' : 'unreadCount.user';

  
  let created!: IChatMessage;
  let targetUserId: string | undefined;
  await runAtomically(async (session) => {
    const [doc] = await ChatMessage.create([messageDoc], { session });
    created = doc;
    const room = await ChatRoom.findOneAndUpdate(
      { _id: roomId },
      { $inc: { [unreadField]: 1 } },
      { session, new: true }
    ).select('userId');
    targetUserId = room?.userId;
  });

  invalidateUnread(roomId, targetUserId);
  return { _id: String(created._id), createdAt: created.createdAt, ...messageDoc };
}

export async function markAdminRead(roomId: string, adminId?: string): Promise<void> {
  await ChatRoom.updateOne({ _id: roomId }, { 'unreadCount.admin': 0 });
  invalidateUnread(roomId);
  if (adminId) {
    invalidateRoomList(adminId);
  }
}

export async function markUserRead(roomId: string, userId?: string): Promise<void> {
  await ChatRoom.updateOne({ _id: roomId }, { 'unreadCount.user': 0 });
  invalidateUnread(roomId, userId);
}

export async function deleteMessage(messageId: string, senderId: string): Promise<string> {
  const existMessage = await ChatMessage.findOne({ _id: messageId, senderId }).select('_id files');
  if (!existMessage) throw new Error('Message not found or unauthorized');

  if (existMessage.files && existMessage.files.length > 0) {
    existMessage.files.forEach((file) => fmDeleteByLink(file));
  }

  await ChatMessage.deleteOne({ _id: messageId });
  return messageId;
}

export async function deleteRoom(roomId: string, adminId: string): Promise<{ userId: string }> {
  const existRoom = await ChatRoom.findOne({ _id: roomId, adminId }).select('_id userId');
  if (!existRoom) throw new Error('Room not found or unauthorized');

  fmDeleteFolder(`/media/chats/${existRoom.userId}`);

  await runAtomically(async (session) => {
    await ChatMessage.deleteMany({ roomId }, { session });
    await ChatRoom.deleteOne({ _id: roomId }, { session });
  });

  invalidateRoomList(adminId);
  invalidateUserRoom(existRoom.userId ?? '');
  invalidateUnread(roomId, existRoom.userId);
  invalidateRoomStatus(roomId);
  return { userId: existRoom.userId ?? '' };
}
