import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import RefreshToken from "../../models/refresh-token.model";
import { rotateRefreshToken } from "../../helpers/token-rotation.helper";

const paths = [
  "/.well-known",
  "/client"
];

const loadAccountIntoLocals = async (res: Response, userId: string, email: string) => {
  const existAccount = await AccountUser.findOne({
    _id: userId,
    email,
    deleted: false,
    status: "active"
  }).select("_id fullName email phone avatar totalPoint usedPoint status");

  if (!existAccount) return false;

  const addressList = await UserAddress.find({ userId: existAccount.id }).select("_id name phone address province district ward type").sort({ createdAt: "desc" });

  res.locals.accountUser = {
    id: existAccount.id,
    fullName: existAccount.fullName,
    email: existAccount.email,
    phone: existAccount.phone,
    avatar: existAccount.avatar,
    addressList,
    totalPoint: existAccount.totalPoint,
    usedPoint: existAccount.usedPoint
  };

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
      } catch (err: any) {
        if (err.name !== "TokenExpiredError") {
          return next();
        }
      }
    }

    const refreshTokenValue = req.cookies.refreshToken;
    if (!refreshTokenValue) return next();

    const storedToken = await RefreshToken.findOne({
      token: refreshTokenValue,
      role: "user",
      expiresAt: { $gt: new Date() }
    });

    if (!storedToken) {
      res.clearCookie("refreshToken", COOKIE_OPTS);
      return next();
    }

    const account = await AccountUser.findOne({
      _id: storedToken.userId,
      deleted: false,
      status: "active"
    }).select("_id email status");

    if (!account) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      res.clearCookie("refreshToken", COOKIE_OPTS);
      return next();
    }

    const outcome = await rotateRefreshToken({
      storedToken,
      account: { id: account.id, email: account.email },
      role: "user",
      accessTokenCookieName: "tokenUser",
      refreshTokenCookieName: "refreshToken",
      res,
    });

    if (outcome === "revoked") return next();

    await loadAccountIntoLocals(res, account.id, account.email ?? "");
    next();
  } catch (error) {
    console.log(error);
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
