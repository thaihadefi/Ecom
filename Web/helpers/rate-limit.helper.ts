import { Request } from "express";
import RateLimit from "../models/rate-limit.model";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}

export interface RateLimitVerdict {
  limited: boolean;
  retryAfterSec: number;
}

export const clientIp = (req: Request): string => req.ip || req.socket.remoteAddress || "unknown";

export const emailOf = (req: Request): string => String(req.body?.email ?? "").trim().toLowerCase();

const isDuplicateKey = (error: unknown): boolean => (error as { code?: number })?.code === 11000;

const hit = async (bucketKey: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const counted = await RateLimit.findOneAndUpdate(
      { key: bucketKey, resetAt: { $gt: new Date(now) } },
      { $inc: { count: 1 } },
      { new: true }
    );
    if (counted) return { count: counted.count, resetAt: counted.resetAt.getTime() };

    const restarted = await RateLimit.findOneAndUpdate(
      { key: bucketKey, resetAt: { $lte: new Date(now) } },
      { $set: { count: 1, resetAt: new Date(now + windowMs) } },
      { new: true }
    );
    if (restarted) return { count: 1, resetAt: restarted.resetAt.getTime() };

    try {
      const created = await RateLimit.create({ key: bucketKey, count: 1, resetAt: new Date(now + windowMs) });
      return { count: 1, resetAt: created.resetAt.getTime() };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  return { count: Number.MAX_SAFE_INTEGER, resetAt: now + windowMs };
};

export const createRateLimiter = ({ windowMs, max, key = clientIp }: RateLimitOptions, name: string) => {
  return async (req: Request): Promise<RateLimitVerdict> => {
    const now = Date.now();
    const bucketKey = `${name}|${req.baseUrl}${req.route?.path ?? req.path}|${key(req)}`.slice(0, 500);
    try {
      const { count, resetAt } = await hit(bucketKey, windowMs, now);
      return { limited: count > max, retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
    } catch (error) {
      console.error("[RateLimit] counter unavailable, request allowed:", error instanceof Error ? error.message : error);
      return { limited: false, retryAfterSec: 0 };
    }
  };
};
