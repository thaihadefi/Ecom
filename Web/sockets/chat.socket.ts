import { Server, Socket } from 'socket.io';
import * as chatSocketService from '../services/socket/chat.socket.service';
import {
  IAdminDeleteRoomPayload,
  IAdminOpenChatPayload,
  IAdminTypingPayload,
  IClientDeleteMessagePayload,
  IClientOpenChatPayload,
  IClientSendMessagePayload,
} from '../interfaces/socket-events.interface';
import { invalidateRoomList } from '../helpers/chat-cache.helper';

export const chatSocket = async (
  io: Server,
  socket: Socket,
  listAdminOnline: Map<string, Set<string>>,
): Promise<void> => {
  const account = socket.data.account;
  if (!account) return;

  const chatRoom = await chatSocketService.initChatRoom(account, listAdminOnline);
  if (!chatRoom) {
    console.warn(`[Socket] chatRoom not found for account: ${account.id} (${account.role})`);
    return;
  }

  const roomId = String(chatRoom._id);
  socket.join(roomId);

  if (account.role === 'admin') {
    await chatSocketService.markAdminRead(roomId);
    socket.to(roomId).emit('SERVER_ADMIN_READ');
  }

  socket.on('ADMIN_OPEN_CHAT', async (data: IAdminOpenChatPayload) => {
    if (account.role !== 'admin') return;
    if (data?.roomId && data.roomId !== roomId) return;
    if (data?.isOpen === false) return;
    await chatSocketService.markAdminRead(roomId);
    socket.to(roomId).emit('SERVER_ADMIN_READ');
  });

  socket.on('CLIENT_SEND_MESSAGE', async (data: IClientSendMessagePayload) => {
    try {
      const status = await chatSocketService.getRoomStatus(roomId);
      if (status === 'locked') {
        socket.emit('SERVER_SEND_STATUS', { code: 'error', message: 'Chat room is locked!' });
        return;
      }

      const message = await chatSocketService.sendMessage(
        roomId,
        account.id,
        account.role,
        data.content,
        data.files ?? [],
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
    socket.to(roomId).emit('SERVER_SEND_ADMIN_TYPING', data);
  });

  socket.on('CLIENT_OPEN_CHAT', async (data: IClientOpenChatPayload) => {
    if (data.isOpen) {
      await chatSocketService.markUserRead(roomId);
      socket.to(roomId).emit('SERVER_CLIENT_READ');
    }
  });

  socket.on('CLIENT_DELETE_MESSAGE', async (data: IClientDeleteMessagePayload) => {
    try {
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
      await chatSocketService.deleteRoom(data.roomId, account.id);
      io.to(roomId).emit('SERVER_DELETE_ROOM', { roomId: data.roomId });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Socket] ADMIN_DELETE_ROOM error:', errorMsg);
    }
  });
};
