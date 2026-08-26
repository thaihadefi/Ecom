import { Response } from 'express';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AccountAdmin from '../../models/account-admin.model';
import Role from '../../models/role.model';
import RefreshToken from '../../models/refresh-token.model';
import { issueRefreshToken, rotateRefreshToken } from "../../helpers/token-rotation.helper";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { IAccountAdmin } from '../../interfaces/models/account-admin.interface';

export interface AdminLoginResult {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  cookieMaxAge?: number;
  adminId?: string;
}

export const loginAdmin = async (
  email: string,
  password?: string,
  remember?: boolean
): Promise<AdminLoginResult> => {
  const existAccount = await AccountAdmin.findOne({ email, deleted: false });

  if (!existAccount) {
    return { success: false, message: "Email does not exist!" };
  }

  const isPasswordValid = bcrypt.compareSync(password || "", `${existAccount.password}`);
  if (!isPasswordValid) {
    return { success: false, message: "Incorrect password!" };
  }

  if (existAccount.status !== "active") {
    return { success: false, message: "Account is not activated!" };
  }

  const tokenTTL = remember ? "7d" : "1d";
  const cookieMaxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const token = jwt.sign(
    { id: existAccount.id, email: existAccount.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: tokenTTL }
  );

  let refreshToken: string | undefined;
  if (remember) {
    refreshToken = await issueRefreshToken(existAccount.id, "admin");
  }

  return {
    success: true,
    message: "Login successful!",
    token,
    refreshToken,
    cookieMaxAge,
    adminId: existAccount.id
  };
};

export const logoutAdmin = async (refreshToken?: string) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
};

export const getAdminAccountForAuth = async (id: string, email: string): Promise<IAccountAdmin | null> => {
  return AccountAdmin.findOne({
    _id: id,
    email,
    deleted: false,
    status: "active"
  }).select("_id fullName email avatar isSuperAdmin roles status");
};

export const getAdminPermissions = async (roleIds: string[]): Promise<string[]> => {
  const roleList = await Role.find({
    _id: { $in: roleIds },
    deleted: false,
    status: "active"
  }).select("_id permissions");
  return roleList.flatMap((r) => r.permissions);
};

export const handleAdminRefreshTokenRotation = async (
  refreshTokenValue: string,
  res: Response
): Promise<IAccountAdmin | null> => {
  const storedToken = await RefreshToken.findOne({
    token: refreshTokenValue,
    role: "admin",
    expiresAt: { $gt: new Date() }
  });

  if (!storedToken) {
    res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
    return null;
  }

  const existAccount = await AccountAdmin.findOne({
    _id: storedToken.userId,
    deleted: false,
    status: "active"
  }).select("_id fullName email avatar isSuperAdmin roles status");

  if (!existAccount) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    res.clearCookie("refreshTokenAdmin", COOKIE_OPTS);
    return null;
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
    return null;
  }

  return existAccount;
};
