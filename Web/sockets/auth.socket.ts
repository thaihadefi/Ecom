import { Socket } from "socket.io";
import * as cookie from 'cookie';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AccountAdmin from "../models/account-admin.model";
import AccountUser from "../models/account-user.model";
import RefreshToken from "../models/refresh-token.model";

type SocketNextFn = (err?: Error) => void;

type SocketRole = "user" | "admin";

interface ResolvedIdentity {
  id: string;
  email: string;
  role: SocketRole;
}

const accountIsActive = async (role: SocketRole, id: string, email: string): Promise<boolean> => {
  const filter = { _id: id, email, deleted: false, status: "active" };
  const found = role === "admin"
    ? await AccountAdmin.findOne(filter).select("_id").lean()
    : await AccountUser.findOne(filter).select("_id").lean();
  return !!found;
};

const identityFromAccessToken = (token: string | undefined, role: SocketRole): ResolvedIdentity | null => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;
    if (!decoded?.id || !decoded?.email) return null;
    return { id: decoded.id, email: decoded.email, role };
  } catch {
    
    return null;
  }
};

const identityFromRefreshToken = async (
  refreshTokenValue: string | undefined,
  role: SocketRole,
): Promise<ResolvedIdentity | null> => {
  if (!refreshTokenValue) return null;

  const stored = await RefreshToken.findOne({
    token: refreshTokenValue,
    role,
    used: false,
    expiresAt: { $gt: new Date() },
  }).select("userId").lean();
  if (!stored) return null;

  const filter = { _id: stored.userId, deleted: false, status: "active" };
  const account = role === "admin"
    ? await AccountAdmin.findOne(filter).select("_id email").lean()
    : await AccountUser.findOne(filter).select("_id email").lean();
  if (!account) return null;

  return { id: String(account._id), email: account.email ?? "", role };
};

export const authSocket = async (socket: Socket, next: SocketNextFn) => {
  try {
    const cookieString = socket.handshake.headers.cookie;
    if (!cookieString) {
      return next(new Error("No cookies"));
    }

    const cookies = cookie.parse(cookieString);
    const intendedRole: unknown = socket.handshake.auth.role;

    
    let role: SocketRole;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    if (intendedRole === "user" && (cookies.tokenUser || cookies.refreshToken)) {
      role = "user";
      accessToken = cookies.tokenUser;
      refreshToken = cookies.refreshToken;
    } else if (cookies.tokenAdmin || cookies.refreshTokenAdmin) {
      role = "admin";
      accessToken = cookies.tokenAdmin;
      refreshToken = cookies.refreshTokenAdmin;
    } else if (cookies.tokenUser || cookies.refreshToken) {
      role = "user";
      accessToken = cookies.tokenUser;
      refreshToken = cookies.refreshToken;
    } else {
      return next(new Error("No token"));
    }

    const identity =
      identityFromAccessToken(accessToken, role) ||
      (await identityFromRefreshToken(refreshToken, role));

    if (!identity) {
      return next(new Error("Session expired"));
    }

    if (!(await accountIsActive(identity.role, identity.id, identity.email))) {
      return next(new Error("Account not available"));
    }

    socket.data.account = {
      id: identity.id,
      email: identity.email,
      role: identity.role,
      roomId: identity.role === "admin" && socket.handshake.auth.roomId
        ? `${socket.handshake.auth.roomId}`
        : "",
    };

    next();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Socket] Auth error:", errorMsg);
    next(new Error("Authentication failed"));
  }
}
