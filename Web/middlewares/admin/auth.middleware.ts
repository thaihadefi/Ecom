import { NextFunction, Request, Response } from "express";
import { pathAdmin, permissionList } from "../../configs/variable.config";
import * as adminAuthService from "../../services/admin/auth.service";
import { RequestAccount } from "../../interfaces/request.interface";
import { bearerTokenOf, isApiRequest, usesAuthorizationHeader, verifyAccessToken } from "../../helpers/access-token.helper";
import { tokenIssuedAtMs } from "../../helpers/token-rotation.helper";

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

const rejectUnauthenticated = (req: Request, res: Response) => {
  if (req.method === "GET" && !isApiRequest(req)) {
    res.redirect(`/${pathAdmin}/account/login`);
  } else {
    res.status(401).json({ code: "error", message: "Please log in!" });
  }
};

export const verifyToken = async (req: RequestAccount, res: Response, next: NextFunction) => {
  try {
    if (usesAuthorizationHeader(req)) {
      const bearer = bearerTokenOf(req);
      let existAccount = null;
      if (bearer) {
        try {
          const decoded = verifyAccessToken(bearer);
          existAccount = await adminAuthService.getAdminAccountForAuth(decoded.id, decoded.email, tokenIssuedAtMs(decoded));
        } catch {
          existAccount = null;
        }
      }
      if (!existAccount) {
        rejectUnauthenticated(req, res);
        return;
      }
      await loadAdminIntoLocals(res, req, existAccount);
      next();
      return;
    }

    const token = req.cookies.tokenAdmin;

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        const existAccount = await adminAuthService.getAdminAccountForAuth(decoded.id, decoded.email, tokenIssuedAtMs(decoded));

        if (existAccount) {
          await loadAdminIntoLocals(res, req, existAccount);
          return next();
        }
      } catch (err: unknown) {
        const errorName = err instanceof Error ? err.name : "";
        if (errorName !== "TokenExpiredError") {
          rejectUnauthenticated(req, res);
          return;
        }
      }
    }

    const refreshTokenValue = req.cookies.refreshTokenAdmin;
    if (!refreshTokenValue) {
      rejectUnauthenticated(req, res);
      return;
    }

    const existAccount = await adminAuthService.handleAdminRefreshTokenRotation(refreshTokenValue, res);
    if (!existAccount) {
      rejectUnauthenticated(req, res);
      return;
    }

    await loadAdminIntoLocals(res, req, existAccount);
    next();
  } catch (error) {
    console.error("[Admin Auth]", error);
    if (req.method === "GET" && !isApiRequest(req)) {
      res.redirect(`/${pathAdmin}/account/login`);
    } else {
      res.status(500).json({ code: "error", message: "An error occurred, please try again!" });
    }
  }
};

const denyPermission = (req: Request, res: Response) => {
  if (req.method === "GET" && !isApiRequest(req)) {
    res.status(403).render("admin/pages/403", { pageTitle: "403 | Access denied" });
  } else {
    res.status(403).json({ code: "error", message: "Insufficient permissions!" });
  }
};

export const checkAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const held: string[] = res.locals.permissions || [];
    if (res.locals.accountAdmin?.isSuperAdmin || permissions.some((permission) => held.includes(permission))) {
      next();
    } else {
      denyPermission(req, res);
    }
  };
};

export const checkPermission = (permission: string) => checkAnyPermission(permission);

