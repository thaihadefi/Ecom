import { NextFunction, Request, Response } from "express";
import { pathAdmin, permissionList } from "../../configs/variable.config";
import jwt from "jsonwebtoken";
import * as adminAuthService from "../../services/admin/auth.service";
import { RequestAccount } from "../../interfaces/request.interface";

interface AdminAccountForLocals {
  id?: string;
  fullName?: string | null;
  email?: string | null;
  avatar?: string | null;
  isSuperAdmin?: boolean;
  roles?: string[];
}

const loadAdminIntoLocals = async (res: Response, req: RequestAccount, existAccount: AdminAccountForLocals) => {
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
    res.locals.permissions = await adminAuthService.getAdminPermissions(existAccount.roles || []);
  }
};

export const verifyToken = async (req: RequestAccount, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.tokenAdmin;

    if (token) {
      try {
        const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`) as jwt.JwtPayload;
        const existAccount = await adminAuthService.getAdminAccountForAuth(decoded.id, decoded.email);

        if (existAccount) {
          await loadAdminIntoLocals(res, req, existAccount);
          return next();
        }
      } catch (err: unknown) {
        const errorName = err instanceof Error ? err.name : "";
        if (errorName !== "TokenExpiredError") {
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

    const existAccount = await adminAuthService.handleAdminRefreshTokenRotation(refreshTokenValue, res);
    if (!existAccount) {
      res.redirect(`/${pathAdmin}/account/login`);
      return;
    }

    await loadAdminIntoLocals(res, req, existAccount);
    next();
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/account/login`);
  }
};

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
};
