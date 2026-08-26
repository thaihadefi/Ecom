import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { authSocket } from "./auth.socket";
import ChatRoom from "../models/chat-room.model";
import { warmCache, CK } from "../helpers/chat-cache.helper";

const listAdminOnline = new Map<string, Set<string>>();
const listUserOnline  = new Map<string, Set<string>>();

const setLastSeen = (userId: string, ts: number) => warmCache.set(CK.lastSeen(userId), ts, 86400);

let _io: Server | null = null;
export const getIO = (): Server | null => _io;

const notifyAdminStatus = async (io: Server, adminId: string, status: "online" | "offline") => {
  try {
    const rooms = await ChatRoom.find({ adminId }).select("userId");
    rooms.forEach(room => {
      io.to(room._id.toString()).emit("SERVER_ADMIN_STATUS", { status });
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Socket] notifyAdminStatus failed:", errorMsg);
  }
};

export const initSocket = (io: Server) => {
  _io = io;
  io.use(authSocket);

  io.on('connection', (socket) => {
    const { account } = socket.data;
    if (!account) return;

    const { id, role } = account;
    console.log(`[Socket] Connected: ${id} (${role}) | transport: ${socket.conn.transport.name} | sid: ${socket.id}`);

    socket.conn.on("upgrade", (transport: { name: string }) => {
      console.log(`[Socket] Transport upgraded: ${id} → ${transport.name}`);
    });

    if (role === "admin") {
      const sockets = listAdminOnline.get(id) || new Set<string>();
      sockets.add(socket.id);
      listAdminOnline.set(id, sockets);

      const LS_PREFIX = "chat:lastseen:";
      const lastSeenMap: Record<string, number> = {};
      warmCache.keys()
        .filter((k: string) => k.startsWith(LS_PREFIX))
        .forEach((k: string) => {
          const userId = k.slice(LS_PREFIX.length);
          if (!listUserOnline.has(userId)) {
            const ts = warmCache.get<number>(k);
            if (ts !== undefined) lastSeenMap[userId] = ts;
          }
        });

      socket.emit("LIST_USER_ONLINE", {
        listUserOnline: Array.from(listUserOnline.keys()),
        lastSeenMap,
      });

      if (sockets.size === 1) notifyAdminStatus(io, id, "online");

    } else if (role === "user") {
      const sockets = listUserOnline.get(id) || new Set<string>();
      sockets.add(socket.id);
      listUserOnline.set(id, sockets);

      socket.broadcast.emit("USER_STATUS_ONLINE", { id, status: "online" });

      ChatRoom.findOne({ userId: id })
        .select("adminId")
        .then(room => {
          if (room && room.adminId) {
            const isOnline = listAdminOnline.has(room.adminId);
            if (isOnline) {
              socket.emit("SERVER_ADMIN_STATUS", { status: "online" });
            } else {
              const lastSeenKey = CK.lastSeen(room.adminId);
              const lastSeenAt = warmCache.get<number>(lastSeenKey);
              socket.emit("SERVER_ADMIN_STATUS", { status: "offline", lastSeenAt });
            }
          } else {
            socket.emit("SERVER_ADMIN_STATUS", { status: "offline" });
          }
        })
        .catch(err => {
          console.error("[Socket] Check admin status failed:", err.message);
        });
    }

    socket.on("disconnect", (reason: string) => {
      console.log(`[Socket] Disconnected: ${id} (${role}) | reason: ${reason} | sid: ${socket.id}`);

      if (role === "admin") {
        const sockets = listAdminOnline.get(id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            listAdminOnline.delete(id);
            notifyAdminStatus(io, id, "offline");
          }
        }
      } else if (role === "user") {
        const sockets = listUserOnline.get(id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            listUserOnline.delete(id);
            const ts = Date.now();
            setLastSeen(id, ts);
            socket.broadcast.emit("USER_STATUS_ONLINE", { id, status: "offline", lastSeenAt: ts });
          }
        }
      }
    });

    chatSocket(io, socket, listAdminOnline);
  });
};
