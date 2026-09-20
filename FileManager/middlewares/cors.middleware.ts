import { NextFunction, Request, Response } from "express";
import { CORS_ORIGINS } from "../config/security.config";

const IS_PROD = process.env.NODE_ENV === "production";

export const cors = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowed = CORS_ORIGINS.length > 0 ? origin !== undefined && CORS_ORIGINS.includes(origin) : !IS_PROD;

  if (allowed) {
    res.header("Access-Control-Allow-Origin", CORS_ORIGINS.length > 0 ? origin : "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  }
  if (CORS_ORIGINS.length > 0) res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
};
