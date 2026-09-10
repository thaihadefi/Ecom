import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { Response } from "express";
import RefreshToken from "../models/refresh-token.model";
import { COOKIE_OPTS } from "../configs/cookie.config";

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 15000;

interface StoredTokenDocument {
  used: boolean;
  rotatedAt?: Date | null;
  expiresAt: Date;
  save: (options?: { session?: mongoose.ClientSession }) => Promise<unknown>;
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
  const { storedToken, account, role, accessTokenCookieName, refreshTokenCookieName, res } = opts;

  const newAccessToken = jwt.sign(
    { id: account.id, email: account.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: "1d" }
  );

  if (storedToken.used) {
    const timePassed = Date.now() - new Date(storedToken.rotatedAt || 0).getTime();

    if (timePassed <= GRACE_PERIOD_MS) {
      res.cookie(accessTokenCookieName, newAccessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_TTL_MS });
      return "grace";
    }

    await RefreshToken.deleteMany({ userId: account.id });
    res.clearCookie(refreshTokenCookieName, COOKIE_OPTS);
    res.clearCookie(accessTokenCookieName, COOKIE_OPTS);
    return "revoked";
  }

  const newRefreshToken = crypto.randomBytes(40).toString("hex");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await RefreshToken.create([{
        userId: account.id,
        token: newRefreshToken,
        role,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      }], { session });

      storedToken.used = true;
      storedToken.rotatedAt = new Date();
      storedToken.expiresAt = new Date(Date.now() + 30000);
      await storedToken.save({ session });
    });
  } finally {
    session.endSession();
  }

  res.cookie(accessTokenCookieName, newAccessToken, { ...COOKIE_OPTS, maxAge: ACCESS_TOKEN_TTL_MS });
  res.cookie(refreshTokenCookieName, newRefreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TOKEN_TTL_MS });

  return "rotated";
};
