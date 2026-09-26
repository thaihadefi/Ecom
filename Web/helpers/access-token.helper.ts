import jwt from "jsonwebtoken";
import { Request } from "express";
import { pathAdmin } from "../configs/variable.config";

// A request that carries an Authorization header is authenticated by that header alone; cookies are then ignored,
// so a bad or expired token is a plain 401 and never falls back to (or refreshes) a browser session.
export const usesAuthorizationHeader = (req: Request): boolean => req.headers.authorization !== undefined;

export const bearerTokenOf = (req: Request): string | undefined => /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1];

export const isApiRequest = (req: Request): boolean => {
  const path = req.originalUrl.split("?")[0];
  const acceptsJson = (req.headers.accept || "").includes("application/json") && !(req.headers.accept || "").includes("text/html");
  return path.startsWith("/api/") || path.startsWith(`/${pathAdmin}/api/`) || usesAuthorizationHeader(req) || acceptsJson || req.xhr === true;
};

export const accessTokenBody = (token: string) => {
  const exp = (jwt.decode(token) as jwt.JwtPayload | null)?.exp;
  return {
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : undefined,
  };
};

// Every token is signed with HS256 (token-rotation.helper.ts); accepting only that algorithm rules out
// algorithm-confusion tokens even if the key handling changes later.
export const JWT_ALGORITHM = "HS256" as const;

export const verifyAccessToken = (token: string): jwt.JwtPayload =>
  jwt.verify(token, `${process.env.JWT_SECRET}`, { algorithms: [JWT_ALGORITHM] }) as jwt.JwtPayload;
