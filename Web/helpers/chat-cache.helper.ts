import NodeCache from "node-cache";

// Tier 1 — Hot (30s): unread badges, frequently read counters
export const hotCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

// Tier 2 — Warm (5min): room lists, user/admin info for chat sidebar
export const warmCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Tier 3 — MongoDB (source of truth, no TTL here)

export const CK = {
  roomList:   (adminId: string) => `chat:roomlist:${adminId}`,
  userRoom:   (userId: string)  => `chat:userroom:${userId}`,
  unread:     (roomId: string)  => `chat:unread:${roomId}`,
  lastSeen:   (userId: string)  => `chat:lastseen:${userId}`,
  roomStatus: (roomId: string)  => `chat:roomstatus:${roomId}`,
};

export const invalidateRoomList   = (adminId: string) => warmCache.del(CK.roomList(adminId));
export const invalidateUserRoom   = (userId: string)  => warmCache.del(CK.userRoom(userId));
export const invalidateUnread     = (roomId: string)  => hotCache.del(CK.unread(roomId));
export const invalidateRoomStatus = (roomId: string)  => warmCache.del(CK.roomStatus(roomId));
