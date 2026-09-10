import NodeCache from "node-cache";

export const hotCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

export const warmCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const CK = {
  roomList:   (adminId: string) => `chat:roomlist:${adminId}`,
  userRoom:   (userId: string)  => `chat:userroom:${userId}`,
  unread:     (roomId: string)  => `chat:unread:${roomId}`,
  unreadUser: (userId: string)  => `chat:unread:user:${userId}`,
  roomStatus: (roomId: string)  => `chat:roomstatus:${roomId}`,
};

export const invalidateRoomList   = (adminId: string) => warmCache.del(CK.roomList(adminId));
export const invalidateUserRoom   = (userId: string)  => warmCache.del(CK.userRoom(userId));
export const invalidateUserUnread = (userId: string)  => hotCache.del(CK.unreadUser(userId));
export const invalidateUnread     = (roomId?: string, userId?: string) => {
  const toDel: string[] = [];
  if (roomId) {
    toDel.push(CK.unread(roomId));
    toDel.push(CK.unreadUser(roomId));
  }
  if (userId) {
    toDel.push(CK.unreadUser(userId));
  }
  if (toDel.length > 0) {
    hotCache.del(toDel);
  } else {
    const keys = hotCache.keys();
    const toDelAll = keys.filter(k => k.startsWith("chat:unread:"));
    if (toDelAll.length > 0) hotCache.del(toDelAll);
  }
};
export const invalidateRoomStatus = (roomId: string)  => warmCache.del(CK.roomStatus(roomId));
