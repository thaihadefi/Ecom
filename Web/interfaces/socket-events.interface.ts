export interface IClientSendMessagePayload {
  content: string;
  files?: string[];
}

export interface IClientDeleteMessagePayload {
  messageId: string;
}

export interface IClientOpenChatPayload {
  isOpen: boolean;
}

export interface IAdminOpenChatPayload {
  roomId?: string;
  isOpen?: boolean;
}

export interface IAdminDeleteRoomPayload {
  roomId: string;
}

export interface IAdminTypingPayload {
  isTyping?: boolean;
}

export interface IServerSendMessagePayload {
  _id: string;
  roomId: string;
  senderId: string;
  senderRole: string;
  content: string;
  files: string[];
}

export interface IServerDeleteMessagePayload {
  messageId: string;
}

export interface IServerDeleteRoomPayload {
  roomId: string;
}

export interface IServerStatusPayload {
  code: string;
  message: string;
}

export interface IServerMessageDeliveredPayload {
  messageId: string;
}

export interface IServerAdminStatusPayload {
  status: 'online' | 'offline';
  lastSeenAt?: number;
}

export interface IUserStatusPayload {
  id: string;
  status: 'online' | 'offline';
  lastSeenAt?: number;
}

export interface IListUserOnlinePayload {
  listUserOnline: string[];
  lastSeenMap: Record<string, number>;
}
