import { Request, Response } from "express";

const VISIT_MS = 30 * 60 * 1000;

const cookieName = (key: string): string => `viewed_${key}`;

export const alreadyViewed = (req: Request, key: string): boolean => Boolean(req.cookies[cookieName(key)]);

export const claimView = (req: Request, res: Response, key: string): boolean => {
  const first = !alreadyViewed(req, key);
  res.cookie(cookieName(key), "true", {
    httpOnly: true,
    sameSite: "strict",
    maxAge: VISIT_MS,
  });
  return first;
};
