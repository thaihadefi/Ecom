import { Socket } from "socket.io";
import * as cookie from 'cookie';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const authSocket = (socket: Socket, next: any) => {
  try {

    const cookieString = socket.handshake.headers.cookie;
    if (!cookieString) {
      return next(new Error("No cookies"));
    }

    const cookieParsed = cookie.parse(cookieString);

    let token: string = "";
    let role: string = "";
    let roomId: string = "";

    // Use role hint from client to determine which token to use
    const intendedRole = socket.handshake.auth.role;

    if (intendedRole === "user" && cookieParsed.tokenUser) {
      // Client explicitly wants to connect as user
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
  } catch (error: any) {
    console.log("[Socket] Auth error:", error?.message || error);
    next(new Error("Authentication failed"));
  }
}