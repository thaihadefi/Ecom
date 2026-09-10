import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import * as clientAuthService from "../../services/client/auth.service";

const paths = [
  "/.well-known",
  "/client"
];

const loadAccountIntoLocals = async (res: Response, userId: string, email: string) => {
  const accountUser = await clientAuthService.getUserAccountForAuth(userId, email);
  if (!accountUser) return false;

  res.locals.accountUser = accountUser;
  return true;
};

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (paths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const token = req.cookies.tokenUser;

    if (token) {
      try {
        const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as JwtPayload;
        await loadAccountIntoLocals(res, decoded.id, decoded.email);
        return next();
      } catch (err: unknown) {
        const errorName = err instanceof Error ? err.name : "";
        if (errorName !== "TokenExpiredError") {
          return next();
        }
      }
    }

    const refreshTokenValue = req.cookies.refreshToken;
    if (!refreshTokenValue) return next();

    const account = await clientAuthService.handleUserRefreshTokenRotation(refreshTokenValue, res);
    if (!account) return next();

    await loadAccountIntoLocals(res, account.id, account.email ?? "");
    next();
  } catch (error) {
    console.error("[Client Auth]", error);
    next();
  }
}

export const loggedIn = async (req: Request, res: Response, next: NextFunction) => {
  if (!res.locals.accountUser) {
    if (req.method == "GET") {
      res.redirect("/auth/login");
    } else {
      res.json({
        code: "error",
        message: "Please log in!"
      });
    }
    return;
  }
  next();
}
