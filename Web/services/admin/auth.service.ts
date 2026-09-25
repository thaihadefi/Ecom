import { Response } from 'express';
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import AccountAdmin from '../../models/account-admin.model';
import Role from '../../models/role.model';
import RefreshToken from '../../models/refresh-token.model';
import { issueRefreshToken, rotateRefreshToken, isIssuedBeforePasswordChange, signAccessToken } from "../../helpers/token-rotation.helper";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { IAccountAdmin } from '../../interfaces/models/account-admin.interface';
import { metadataCache } from '../../helpers/metadata-cache.helper';
import { permissionList } from '../../configs/variable.config';

export interface AdminLoginResult {
  success: boolean;
  status?: number;
  message: string;
  token?: string;
  refreshToken?: string;
  cookieMaxAge?: number;
  adminId?: string;
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

export const loginAdmin = async (
  email: string,
  password?: string,
  remember?: boolean
): Promise<AdminLoginResult> => {
  const existAccount = await AccountAdmin.findOne({ email, deleted: false });

  const isPasswordValid = bcrypt.compareSync(password || "", existAccount ? `${existAccount.password}` : DUMMY_PASSWORD_HASH);
  if (!existAccount || !isPasswordValid) {
    return { success: false, status: 401, message: "Invalid email or password!" };
  }

  if (existAccount.status !== "active") {
    return { success: false, status: 403, message: "Account is not activated!" };
  }

  const tokenTTL = remember ? "7d" : "1d";
  const cookieMaxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const token = signAccessToken({ id: existAccount.id, email: existAccount.email }, tokenTTL);

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

export const invalidateAdminAuthCache = (id?: string) => {
  if (id) {
    metadataCache.del(`admin:auth:${id}`);
  } else {
    const keys = metadataCache.keys();
    const toDel = keys.filter(k => k.startsWith("admin:auth:") || k.startsWith("admin:roles:"));
    if (toDel.length > 0) metadataCache.del(toDel);
  }
};

export const getAdminAccountForAuth = async (id: string, email: string, issuedAtMs?: number): Promise<IAccountAdmin | null> => {
  const cacheKey = `admin:auth:${id}`;
  const cached = metadataCache.get<IAccountAdmin>(cacheKey);
  if (cached) {
    if (cached.email !== email || isIssuedBeforePasswordChange(issuedAtMs, cached.passwordChangedAt)) return null;
    return cached;
  }

  const account = await AccountAdmin.findOne({
    _id: id,
    email,
    deleted: false,
    status: "active"
  }).select("_id fullName email avatar isSuperAdmin roles status passwordChangedAt");

  if (!account || isIssuedBeforePasswordChange(issuedAtMs, account.passwordChangedAt)) return null;

  metadataCache.set(cacheKey, account, 60);
  return account;
};

export const getAdminPermissions = async (roleIds: string[]): Promise<string[]> => {
  roleIds = (roleIds || []).filter((id) => mongoose.isValidObjectId(id));
  if (roleIds.length === 0) return [];
  const cacheKey = `admin:roles:${[...roleIds].sort().join(",")}`;
  const cached = metadataCache.get<string[]>(cacheKey);
  if (cached) return cached;

  const roleList = await Role.find({
    _id: { $in: roleIds },
    deleted: false,
    status: "active"
  }).select("_id permissions");
  const permissions = roleList.flatMap((r) => r.permissions);

  metadataCache.set(cacheKey, permissions, 300);
  return permissions;
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

export const getEffectivePermissions = async (account: { roles?: string[]; isSuperAdmin?: boolean }): Promise<string[]> => {
  if (account.isSuperAdmin) return permissionList.map((item) => item.id);
  return getAdminPermissions(account.roles || []);
};

export const filterAdminIdsWithPermission = async (adminIds: string[], permission: string): Promise<string[]> => {
  if (adminIds.length === 0) return [];
  const accounts = await AccountAdmin.find({ _id: { $in: adminIds }, deleted: false, status: "active" }).select("_id roles isSuperAdmin");
  const allowed: string[] = [];
  for (const account of accounts) {
    if ((await getEffectivePermissions(account)).includes(permission)) allowed.push(String(account._id));
  }
  return allowed;
};
