import { Request, Response, NextFunction } from "express";

export const canonical = (req: Request, res: Response, next: NextFunction) => {
  const protocol = req.protocol;
  const host = req.get("host");

  // Get path without query string
  const path = req.originalUrl.split("?")[0];

  res.locals.canonicalUrl = `${protocol}://${host}${path}`;
  next();
};
