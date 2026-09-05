import { Server, Socket } from 'socket.io';
import * as chatSocketService from '../services/socket/chat.socket.service';
import {
  IAdminDeleteRoomPayload,
  IAdminOpenChatPayload,
  IAdminTypingPayload,
  IClientDeleteMessagePayload,
  IClientOpenChatPayload,
  IClientSendMessagePayload,
  IClientTypingPayload,
} from '../interfaces/socket-events.interface';
import { invalidateRoomList } from '../helpers/chat-cache.helper';
import { getLastSeen } from '../helpers/presence.helper';

const MAX_CONTENT_LENGTH = 5000;
const MAX_FILES_PER_MESSAGE = 10;
const MAX_FILE_PATH_LENGTH = 512;

const RATE_WINDOW_MS = 10_000;
const RATE_MAX_WRITES = 25;

const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

const sanitizeFiles = (raw: unknown, roomUserId: string): string[] => {
  if (!Array.isArray(raw) || !roomUserId) return [];
  const prefix = `/media/chats/${roomUserId}/`;
  return raw
    .filter((f): f is string =>
      typeof f === 'string' &&
      f.length > prefix.length &&
      f.length <= MAX_FILE_PATH_LENGTH &&
      f.startsWith(prefix) &&
      !f.includes('..'))
    .slice(0, MAX_FILES_PER_MESSAGE);
};

export const chatSocket = async (
  io: Server,
  socket: Socket,
  listAdminOnline: Map<string, Set<string>>,
): Promise<void> => {
  const account = socket.data.account;
  if (!account) return;

  const chatRoom = await chatSocketService.initChatRoom(account, listAdminOnline, io);
  if (!chatRoom) {
    
    if (!(account.role === 'admin' && !account.roomId)) {
      console.warn(`[Socket] chatRoom not found for account: ${account.id} (${account.role})`);
    }
    return;
  }

  const roomId = String(chatRoom._id);
  const roomUserId = account.role === 'user' ? account.id : (chatRoom.userId ?? '');
  socket.join(roomId);

  
  if (account.role === 'user') {
    const assignedAdminId = chatRoom.adminId || '';
    const adminOnline = assignedAdminId ? listAdminOnline.has(assignedAdminId) : false;
    socket.emit('SERVER_ADMIN_STATUS', {
      status: adminOnline ? 'online' : 'offline',
      adminId: assignedAdminId || undefined,
      lastSeenAt: assignedAdminId && !adminOnline ? await getLastSeen('admin', assignedAdminId) : undefined,
      serverNow: Date.now(),
    });
  }

  const writeTimestamps: number[] = [];
  const rateLimited = (): boolean => {
    const now = Date.now();
    while (writeTimestamps.length > 0 && writeTimestamps[0] < now - RATE_WINDOW_MS) {
      writeTimestamps.shift();
    }
    if (writeTimestamps.length >= RATE_MAX_WRITES) return true;
    writeTimestamps.push(now);
    return false;
  };

  if (account.role === 'admin') {
    await chatSocketService.markAdminRead(roomId);
    socket.to(roomId).emit('SERVER_ADMIN_READ');
  }

  socket.on('ADMIN_OPEN_CHAT', async (data: IAdminOpenChatPayload) => {
    if (account.role !== 'admin') return;
    if (data?.roomId && data.roomId !== roomId) return;
    if (data?.isOpen === false) return;
    if (rateLimited()) return;
    await chatSocketService.markAdminRead(roomId);
    socket.to(roomId).emit('SERVER_ADMIN_READ');
  });

  socket.on('CLIENT_SEND_MESSAGE', async (data: IClientSendMessagePayload) => {
    try {
      const content = typeof data?.content === 'string' ? data.content.trim() : '';
      const files = sanitizeFiles(data?.files, roomUserId);

      if (!content && files.length === 0) return;
      if (content.length > MAX_CONTENT_LENGTH) {
        socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Message is too long.' });
        return;
      }
      if (rateLimited()) {
        socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'You are sending messages too fast.' });
        return;
      }

      const status = await chatSocketService.getRoomStatus(roomId);
      if (status === 'locked') {
        socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Chat room is locked!' });
        return;
      }

      const message = await chatSocketService.sendMessage(
        roomId,
        account.id,
        account.role,
        content,
        files,
      );
      invalidateRoomList(chatRoom.adminId ?? '');
      io.to(roomId).emit('SERVER_SEND_MESSAGE', message);

      const roomSockets = await io.in(roomId).fetchSockets();
      const recipientRole = account.role === 'admin' ? 'user' : 'admin';
      if (roomSockets.some((s) => (s.data as { account?: { role?: string } })?.account?.role === recipientRole)) {
        socket.emit('SERVER_MESSAGE_DELIVERED', { messageId: message._id });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Socket] CLIENT_SEND_MESSAGE error:', errorMsg);
      socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Failed to send message.' });
    }
  });

  socket.on('ADMIN_TYPING', (data: IAdminTypingPayload) => {
    socket.to(roomId).emit('SERVER_SEND_ADMIN_TYPING', { isTyping: Boolean(data?.isTyping) });
  });

  socket.on('CLIENT_TYPING', (data: IClientTypingPayload) => {
    socket.to(roomId).emit('SERVER_SEND_CLIENT_TYPING', { isTyping: Boolean(data?.isTyping) });
  });

  socket.on('CLIENT_OPEN_CHAT', async (data: IClientOpenChatPayload) => {
    if (data?.isOpen && !rateLimited()) {
      await chatSocketService.markUserRead(roomId);
      socket.to(roomId).emit('SERVER_CLIENT_READ');
    }
  });

  socket.on('CLIENT_DELETE_MESSAGE', async (data: IClientDeleteMessagePayload) => {
    try {
      if (!isObjectId(data?.messageId) || rateLimited()) return;
      const messageId = await chatSocketService.deleteMessage(data.messageId, account.id);
      invalidateRoomList(chatRoom.adminId ?? '');
      io.to(roomId).emit('SERVER_DELETE_MESSAGE', { messageId });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Socket] CLIENT_DELETE_MESSAGE error:', errorMsg);
    }
  });

  socket.on('ADMIN_DELETE_ROOM', async (data: IAdminDeleteRoomPayload) => {
    try {
      if (account.role !== 'admin') return;
      const targetRoomId = isObjectId(data?.roomId) ? data.roomId : roomId;
      await chatSocketService.deleteRoom(targetRoomId, account.id);
      io.to(targetRoomId).emit('SERVER_DELETE_ROOM', { roomId: targetRoomId });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Socket] ADMIN_DELETE_ROOM error:', errorMsg);
    }
  });
};
