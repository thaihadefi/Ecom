import { NextFunction, Request, Response } from "express";
import { pathAdmin, permissionList } from "../../configs/variable.config";
import jwt from "jsonwebtoken";
import AccountAdmin from "../../models/account-admin.model";
import Role from "../../models/role.model";
import RefreshToken from "../../models/refresh-token.model";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { RequestAccount } from "../../interfaces/request.interface";
import { rotateRefreshToken } from "../../helpers/token-rotation.helper";

const loadAdminIntoLocals = async (res: Response, req: RequestAccount, existAccount: any) => {
  res.locals.accountAdmin = {
    id: existAccount.id,
    fullName: existAccount.fullName,
    email: existAccount.email,
    avatar: existAccount.avatar,
    isSuperAdmin: existAccount.isSuperAdmin || false
  };

  req.adminId = existAccount.id;

  if (existAccount.isSuperAdmin) {
    res.locals.permissions = permissionList.map(item => item.id);
  } else {
    const roleList = await Role.find({
      _id: { $in: existAccount.roles },
      deleted: false,
      status: "active"
    }).select("_id permissions");
    const permissions: string[] = roleList.flatMap((r: any) => r.permissions);
    res.locals.permissions = permissions;
  }
};

export const verifyToken = async (req: RequestAccount, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.tokenAdmin;

    if (token) {
      try {
        const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as jwt.JwtPayload;
        const existAccount = await AccountAdmin.findOne({
          _id: decoded.id,
          email: decoded.email,
          deleted: false,
          status: "active"
        }).select("_id fullName email avatar isSuperAdmin roles status");

        if (existAccount) {
          await loadAdminIntoLocals(res, req, existAccount);
          return next();
        }
      } catch (err: any) {
        if (err.name !== "TokenExpiredError") {
          res.redirect(`/${pathAdmin}/account/login`);
          return;
        }
      }
    }

    const refreshTokenValue = req.cookies.refreshTokenAdmin;
    if (!refreshTokenValue) {
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    const storedToken = await RefreshToken.findOne({
      token: refreshTokenValue,
      role: "admin",
      expiresAt: { $gt: new Date() }
    });

    if (!storedToken) {
      res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    const existAccount = await AccountAdmin.findOne({
      _id: storedToken.userId,
      deleted: false,
      status: "active"
    }).select("_id fullName email avatar isSuperAdmin roles status");

    if (!existAccount) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    const outcome = await rotateRefreshToken({
      storedToken,
      account: { id: existAccount.id, email: existAccount.email },
      role: "admin",
      accessTokenCookieName: "tokenAdmin",
      refreshTokenCookieName: "refreshTokenAdmin",
      res,
    });

    if (outcome === "revoked") {
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    await loadAdminIntoLocals(res, req, existAccount);
    next();
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/account/login`);
  }
}

export const checkPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (res.locals.accountAdmin?.isSuperAdmin || res.locals.permissions?.includes(permission)) {
      next();
    } else if (req.method === "GET") {
      res.redirect(`/${pathAdmin}/dashboard`);
    } else {
      res.json({ code: "error", message: "Insufficient permissions!" });
    }
  };
}
