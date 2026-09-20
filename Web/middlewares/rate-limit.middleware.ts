import { NextFunction, Request, Response } from "express";
import { createRateLimiter, RateLimitOptions } from "../helpers/rate-limit.helper";

export const pageRateLimit = (...limits: RateLimitOptions[]) => {
  const limiters = limits.map((limit, index) => createRateLimiter(limit, `l${index}`));
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const check of limiters) {
      const verdict = await check(req);
      if (verdict.limited) {
        res.set("Retry-After", String(verdict.retryAfterSec));
        res.status(429).json({ code: "error", message: "Too many attempts. Please try again later." });
        return;
      }
    }
    next();
  };
};

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
