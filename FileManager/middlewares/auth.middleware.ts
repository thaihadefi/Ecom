import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { recordFailure, retryAfterSeconds } from "./auth-failure-limit.middleware";

const safeEqual = (a: string, b: string): boolean => {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
};

export const verifySecret = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!process.env.FILE_MANAGER_SECRET) {
      res.status(500).json({
        code: "error",
        message: "Server misconfiguration: Secret key is not set!"
      });
      return;
    }

    if (!authHeader || !safeEqual(authHeader, `Bearer ${process.env.FILE_MANAGER_SECRET}`)) {
      const retryAfter = retryAfterSeconds(req);
      if (retryAfter > 0) {
        res.setHeader("Retry-After", retryAfter);
        res.status(429).json({ code: "error", message: "Too many failed attempts, try again later!" });
        return;
      }
      recordFailure(req);
      res.status(401).json({
        code: "error",
        message: "Access denied!"
      });
      return;
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      code: "error",
      message: "Internal server error during authentication!"
    });
  }
}
