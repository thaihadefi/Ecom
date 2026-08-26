import { Socket } from "socket.io";
import * as cookie from 'cookie';
import jwt, { JwtPayload } from 'jsonwebtoken';

type SocketNextFn = (err?: Error) => void;

export const authSocket = (socket: Socket, next: SocketNextFn) => {
  try {

    const cookieString = socket.handshake.headers.cookie;
    if (!cookieString) {
      return next(new Error("No cookies"));
    }

    const cookieParsed = cookie.parse(cookieString);

    let token: string = "";
    let role: string = "";
    let roomId: string = "";

    const intendedRole = socket.handshake.auth.role;

    if (intendedRole === "user" && cookieParsed.tokenUser) {
      token = cookieParsed.tokenUser;
      role = "user";
    } else if (cookieParsed.tokenAdmin) {
      token = cookieParsed.tokenAdmin;
      role = "admin";
      roomId = socket.handshake.auth.roomId ? `${socket.handshake.auth.roomId}` : "";
    } else if (cookieParsed.tokenUser) {
      token = cookieParsed.tokenUser;
      role = "user";
    }

    if (!token || !role) {
      return next(new Error("No token"));
    }

    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;

    if (!decoded?.id || !decoded?.email) {
      return next(new Error("Invalid token payload"));
    }

    socket.data.account = {
      id: decoded.id,
      email: decoded.email,
      role,
      roomId
    };

    next();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.log("[Socket] Auth error:", errorMsg);
    next(new Error("Authentication failed"));
  }
}
