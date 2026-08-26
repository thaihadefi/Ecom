import { Request, Response } from 'express';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { RequestAccount } from '../../interfaces/request.interface';
import { REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";
import * as authService from '../../services/admin/auth.service';

export const login = async (_req: Request, res: Response) => {
  res.render("admin/pages/account-login", {
    pageTitle: "Admin Login"
  });
};

export const loginPost = async (req: RequestAccount, res: Response) => {
  const { email, password, rememberPassword } = req.body;
  const remember =
    rememberPassword === true ||
    rememberPassword === "true" ||
    rememberPassword === "on" ||
    rememberPassword === 1 ||
    rememberPassword === "1";

  const result = await authService.loginAdmin(email, password, remember);

  if (!result.success) {
    res.json({
      code: "error",
      message: result.message
    });
    return;
  }

  req.adminId = result.adminId;

  if (result.token) {
    res.cookie("tokenAdmin", result.token, {
      ...COOKIE_OPTS,
      maxAge: result.cookieMaxAge
    });
  }

  if (remember && result.refreshToken) {
    res.cookie("refreshTokenAdmin", result.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  logAdminAction(req, "Logged in");

  res.json({
    code: "success",
    message: result.message
  });
};

export const logout = async (req: Request, res: Response) => {
  logAdminAction(req, "Logged out");
  const refreshToken = req.cookies.refreshTokenAdmin;
  await authService.logoutAdmin(refreshToken);

  res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
  res.clearCookie("tokenAdmin", COOKIE_OPTS);
  res.redirect(`/${pathAdmin}/account/login`);
};
