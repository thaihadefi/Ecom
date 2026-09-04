import mongoose from 'mongoose';
import ChatRoom from '../../models/chat-room.model';
import ChatMessage from '../../models/chat-message.model';
import AccountAdmin from '../../models/account-admin.model';
import { IChatRoom } from '../../interfaces/models/chat-room.interface';
import { IChatMessage } from '../../interfaces/models/chat-message.interface';
import {
  invalidateRoomList,
  invalidateUnread,
  invalidateUserRoom,
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

// Must match ADMINS_ROOM in index.socket.ts — every staff socket is in it.
const ADMINS_ROOM = 'admins';

const TXN_UNSUPPORTED = /Transaction numbers are only allowed|replica set|Transactions? (are|is) not supported|does not support transactions|Sessions are not supported/i;

// Flipped the first time a transaction fails because the deployment has no
// replica set, so we stop paying for a doomed transaction attempt every call.
let transactionsUnsupported = false;

/**
 * Run `work` inside a transaction where the deployment supports one (Atlas or any
 * replica set) and fall back to sequential writes on a standalone mongod, so
 * local development without a replica set still works. `work` MUST be safe to run
 * twice (withTransaction retries on transient errors) — build fresh documents
 * inside it rather than reusing an outer one.
 */
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
      console.warn('[Socket] MongoDB has no transaction support — chat writes fall back to non-atomic mode.');
    } finally {
      session.endSession();
    }
  }
  await work(); // standalone mongod: transactions unavailable
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

const isAssignableAdmin = (adminId: string): Promise<boolean> =>
  AccountAdmin.exists({ _id: adminId, deleted: false, status: 'active' }).then(Boolean);

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
  // Reassign when the room has no admin, or its admin was deactivated / deleted.
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

  // Only balance across online admins that are still active accounts.
  const activeOnline = (
    await AccountAdmin.find({ _id: { $in: listIdAdminOnline }, deleted: false, status: 'active' }).select('_id').lean()
  ).map(a => String(a._id));

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
    const fallbackAdmin = await AccountAdmin.findOne({ deleted: false, status: 'active' }).select('_id');
    if (fallbackAdmin) selectedAdminId = fallbackAdmin.id;
  }

  if (!selectedAdminId) return chatRoom;

  // Optimistic claim: only write if the room's admin hasn't changed since we
  // read it, so concurrent connects (multi-tab, or reassigning an orphaned
  // room) don't fight over it.
  const previousAdminId = chatRoom.adminId || '';
  const updated = await ChatRoom.findOneAndUpdate(
    { _id: chatRoom._id, adminId: previousAdminId },
    { adminId: selectedAdminId },
    { new: true },
  );
  if (!updated) return ChatRoom.findById(chatRoom._id); // another connection already assigned
  invalidateRoomList(selectedAdminId);
  if (previousAdminId) {
    invalidateRoomList(previousAdminId);
    // The room moved off a now-invalid admin — let any staff viewing their inbox refresh.
    io.to(ADMINS_ROOM).emit('SERVER_ROOM_ASSIGNED', { roomId: String(updated._id), adminId: selectedAdminId });
  }
  return updated;
}

async function initAdminRoom(adminId: string, roomId: string): Promise<IChatRoom | null> {
  if (!roomId || !/^[0-9a-fA-F]{24}$/.test(roomId)) return null;
  const chatRoom = await ChatRoom.findOne({ _id: roomId }).select('adminId userId');
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
  const unreadField = senderRole === 'user' ? 'unreadCount.admin' : 'unreadCount.user';

  // Create the document inside the callback so a withTransaction retry inserts a
  // fresh doc instead of re-saving a stale one.
  let created!: IChatMessage;
  await runAtomically(async (session) => {
    const [doc] = await ChatMessage.create([messageDoc], { session });
    created = doc;
    await ChatRoom.updateOne({ _id: roomId }, { $inc: { [unreadField]: 1 } }, { session });
  });

  invalidateUnread(roomId);
  return { _id: String(created._id), createdAt: created.createdAt, ...messageDoc };
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
  return { userId: existRoom.userId ?? '' };
}
