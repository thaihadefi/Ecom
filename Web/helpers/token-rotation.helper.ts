import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { Response } from "express";
import RefreshToken from "../models/refresh-token.model";
import { COOKIE_OPTS } from "../configs/cookie.config";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 15000;

export const issueRefreshToken = async (userId: string, role: "user" | "admin"): Promise<string> => {
  const token = crypto.randomBytes(40).toString("hex");
  await RefreshToken.create({
    userId,
    token,
    role,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return token;
};

// iatMs carries the issue time in milliseconds: the standard iat claim is whole seconds, so a token
// issued earlier in the same second as a password change could not be told apart from a newer one.
export const signAccessToken = (account: { id: string; email?: string | null }, expiresIn: "1d" | "7d" = "1d"): string =>
  jwt.sign({ id: account.id, email: account.email, iatMs: Date.now() }, `${process.env.JWT_SECRET}`, { expiresIn });

// Tokens signed before iatMs existed fall back to iat, keeping their old whole-second comparison.
export const tokenIssuedAtMs = (decoded: JwtPayload): number | undefined => {
  if (typeof decoded.iatMs === "number") return decoded.iatMs;
  return typeof decoded.iat === "number" ? decoded.iat * 1000 + 999 : undefined;
};

export const isIssuedBeforePasswordChange = (issuedAtMs: number | undefined, passwordChangedAt?: Date | null): boolean => {
  if (!passwordChangedAt || issuedAtMs === undefined) return false;
  return issuedAtMs < new Date(passwordChangedAt).getTime();
};

export const revokeRefreshTokens = async (userId: string, role: "user" | "admin"): Promise<void> => {
  await RefreshToken.deleteMany({ userId, role });
};

interface StoredTokenDocument {
  _id: mongoose.Types.ObjectId;
  used: boolean;
  rotatedAt?: Date | null;
}

interface RotateOptions {
  storedToken: StoredTokenDocument;
  account: { id: string; email?: string | null };
  role: "user" | "admin";
  accessTokenCookieName: string;
  refreshTokenCookieName: string;
  res: Response;
}

export type RotateOutcome = "rotated" | "grace" | "revoked";

export const rotateRefreshToken = async (opts: RotateOptions): Promise<RotateOutcome> => {
  const { account, role, accessTokenCookieName, refreshTokenCookieName, res } = opts;
  let { storedToken } = opts;

  const newAccessToken = signAccessToken(account);

  if (!storedToken.used) {
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: storedToken._id, used: false },
      { $set: { used: true, rotatedAt: new Date() } },
    );

    if (claimed) {
      const newRefreshToken = crypto.randomBytes(40).toString("hex");
      try {
        await RefreshToken.create({
          userId: account.id,
          token: newRefreshToken,
          role,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        });
      } catch (error) {
        await RefreshToken.updateOne({ _id: storedToken._id }, { $set: { used: false }, $unset: { rotatedAt: 1 } });
        throw error;
      }

      res.cookie(accessTokenCookieName, newAccessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_TTL_MS });
      res.cookie(refreshTokenCookieName, newRefreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TOKEN_TTL_MS });
      return "rotated";
    }

    const fresh = await RefreshToken.findById(storedToken._id);
    if (!fresh) return "revoked";
    storedToken = fresh;
  }

  const timePassed = Date.now() - new Date(storedToken.rotatedAt || 0).getTime();

  if (timePassed <= GRACE_PERIOD_MS) {
    res.cookie(accessTokenCookieName, newAccessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_TTL_MS });
    return "grace";
  }

  await RefreshToken.deleteMany({ userId: account.id, role });
  res.clearCookie(refreshTokenCookieName, COOKIE_OPTS);
  res.clearCookie(accessTokenCookieName, COOKIE_OPTS);
  return "revoked";
};
