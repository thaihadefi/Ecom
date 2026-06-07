import { Request, Response } from 'express';
import AccountAdmin from '../../models/account-admin.model';
import bcrypt from "bcryptjs";
import RefreshToken from '../../models/refresh-token.model';
import { pathAdmin } from '../../configs/variable.config';
import { logAdminAction } from '../../helpers/log.helper';
import { COOKIE_OPTS } from '../../configs/cookie.config';
import jwt from "jsonwebtoken";
import { RequestAccount } from '../../interfaces/request.interface';
import { issueRefreshToken, REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";

export const login = async (req: Request, res: Response) => {
  res.render("admin/pages/account-login", {
    pageTitle: "Admin Login"
  });
}

export const loginPost = async (req: RequestAccount, res: Response) => {
  const { email, password, rememberPassword } = req.body;
  const remember =
    rememberPassword === true ||
    rememberPassword === "true" ||
    rememberPassword === "on" ||
    rememberPassword === 1 ||
    rememberPassword === "1";

  const existAccount = await AccountAdmin.findOne({ email, deleted: false });

  if (!existAccount) {
    res.json({ code: "error", message: "Email does not exist!" });
    return;
  }

  const isPasswordValid = bcrypt.compareSync(password, `${existAccount.password}`);
  if (!isPasswordValid) {
    res.json({ code: "error", message: "Incorrect password!" });
    return;
  }

  if (existAccount.status !== "active") {
    res.json({ code: "error", message: "Account is not activated!" });
    return;
  }

  const tokenTTL = remember ? "7d" : "1d";
  const cookieMaxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const token = jwt.sign(
      { id: existAccount.id, email: existAccount.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: tokenTTL
      }
    );

  req.adminId = existAccount.id;

  res.cookie("tokenAdmin", token, {
    ...COOKIE_OPTS,
    maxAge: cookieMaxAge
  });

  if (remember) {
    const refreshToken = await issueRefreshToken(existAccount.id, "admin");
    res.cookie("refreshTokenAdmin", refreshToken, {
      ...COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  logAdminAction(req, "Logged in");

  res.json({
    code: "success",
    message: "Login successful!"
  })
}

export const logout = async (req: Request, res: Response) => {
  logAdminAction(req, "Logged out");
  const refreshToken = req.cookies.refreshTokenAdmin;
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
  res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
  res.clearCookie("tokenAdmin", COOKIE_OPTS);
  res.redirect(`/${pathAdmin}/account/login`);
}