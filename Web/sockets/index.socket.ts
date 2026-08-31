import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { authSocket } from "./auth.socket";
import ChatRoom from "../models/chat-room.model";
import { touchLastSeen, touchLastSeenMany, getLastSeenMany } from "../helpers/presence.helper";

// Presence is tracked in-process: this app runs as a single Node instance
// (see README — NodeCache, no Redis). Horizontal scaling would need the
// Socket.IO Redis adapter plus a shared presence store in place of these Maps.
const listAdminOnline = new Map<string, Set<string>>();
const listUserOnline  = new Map<string, Set<string>>();

// Every admin socket joins this room so user-presence events reach only staff,
// never other customers.
const ADMINS_ROOM = "admins";

/** Refresh last-seen for every connected account so an ungraceful crash never
 *  leaves a timestamp staler than this interval. */
const PRESENCE_HEARTBEAT_MS = 60_000;

/** Connection lifecycle chatter — useful in dev, noise in production. */
const socketDebug = (...args: unknown[]): void => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

let _io: Server | null = null;
let _heartbeat: ReturnType<typeof setInterval> | null = null;
export const getIO = (): Server | null => _io;

/** Stop background timers before the process exits (called from graceful shutdown). */
export const stopSocket = (): void => {
  if (_heartbeat) {
    clearInterval(_heartbeat);
    _heartbeat = null;
  }
};

const notifyAdminStatus = async (io: Server, adminId: string, status: "online" | "offline") => {
  const now = Date.now();
  if (status === "offline") void touchLastSeen("admin", adminId);
  try {
    const rooms = await ChatRoom.find({ adminId }).select("userId").lean();
    rooms.forEach(room => {
      io.to(room._id.toString()).emit("SERVER_ADMIN_STATUS", {
        status,
        lastSeenAt: status === "offline" ? now : undefined,
        adminId,
        serverNow: now,
      });
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Socket] notifyAdminStatus failed:", errorMsg);
  }
};

const handleAdminConnect = async (io: Server, socket: import("socket.io").Socket, adminId: string) => {
  const sockets = listAdminOnline.get(adminId) ?? new Set<string>();
  // Decide before any await — a concurrent second socket for the same admin
  // must not make both handlers think they are not the first.
  const isFirstSocket = sockets.size === 0;
  sockets.add(socket.id);
  listAdminOnline.set(adminId, sockets);
  socket.join(ADMINS_ROOM);

  void touchLastSeen("admin", adminId); // best-effort; presence events go out first

  try {
    const rooms = await ChatRoom.find({ adminId }).select("userId").lean();
    const offlineUserIds = rooms
      .map(r => String(r.userId))
      .filter(uid => uid && !listUserOnline.has(uid));

    socket.emit("LIST_USER_ONLINE", {
      listUserOnline: Array.from(listUserOnline.keys()),
      lastSeenMap: await getLastSeenMany("user", offlineUserIds),
      serverNow: Date.now(),
    });
  } catch (err: unknown) {
    console.error("[Socket] admin connect roster failed:", err instanceof Error ? err.message : err);
  }

  if (isFirstSocket) await notifyAdminStatus(io, adminId, "online");
};

const handleUserConnect = (io: Server, socket: import("socket.io").Socket, userId: string) => {
  const sockets = listUserOnline.get(userId) ?? new Set<string>();
  sockets.add(socket.id);
  listUserOnline.set(userId, sockets);

  void touchLastSeen("user", userId); // best-effort; presence events go out first
  io.to(ADMINS_ROOM).emit("USER_STATUS_ONLINE", { id: userId, status: "online", serverNow: Date.now() });
  // The user's SERVER_ADMIN_STATUS is emitted from chatSocket() once the room
  // (and its admin assignment) is resolved — doing it here races the room upsert.
};

export const initSocket = (io: Server) => {
  _io = io;
  io.use(authSocket);

  stopSocket();
  _heartbeat = setInterval(() => {
    void touchLastSeenMany("admin", Array.from(listAdminOnline.keys()));
    void touchLastSeenMany("user", Array.from(listUserOnline.keys()));
  }, PRESENCE_HEARTBEAT_MS);
  _heartbeat.unref?.();

  io.on('connection', (socket) => {
    const { account } = socket.data;
    if (!account) return;

    const { id, role } = account;
    socketDebug(`[Socket] Connected: ${id} (${role}) | transport: ${socket.conn.transport.name} | sid: ${socket.id}`);

    socket.conn.on("upgrade", (transport: { name: string }) => {
      socketDebug(`[Socket] Transport upgraded: ${id} → ${transport.name}`);
    });

    if (role === "admin") {
      handleAdminConnect(io, socket, id).catch(err =>
        console.error("[Socket] handleAdminConnect failed:", err instanceof Error ? err.message : err));
    } else if (role === "user") {
      handleUserConnect(io, socket, id);
    }

    socket.on("disconnect", async (reason: string) => {
      socketDebug(`[Socket] Disconnected: ${id} (${role}) | reason: ${reason} | sid: ${socket.id}`);

      if (role === "admin") {
        const sockets = listAdminOnline.get(id);
        if (!sockets) return;
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          listAdminOnline.delete(id);
          await notifyAdminStatus(io, id, "offline");
        }
      } else if (role === "user") {
        const sockets = listUserOnline.get(id);
        if (!sockets) return;
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          listUserOnline.delete(id);
          const now = Date.now();
          void touchLastSeen("user", id);
          io.to(ADMINS_ROOM).emit("USER_STATUS_ONLINE", {
            id,
            status: "offline",
            lastSeenAt: now,
            serverNow: now,
          });
        }
      }
    });

    chatSocket(io, socket, listAdminOnline).catch(err =>
      console.error("[Socket] chatSocket init failed:", err instanceof Error ? err.message : err));
  });
};
