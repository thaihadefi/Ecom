import { Response } from 'express';
import { toSearchText } from '../../helpers/slugify.helper';
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";
import RefreshToken from "../../models/refresh-token.model";
import VerifyOTP from "../../models/verify-otp.model";
import { consumeOtp } from "../../helpers/otp.helper";
import bcrypt from "bcryptjs";
import { generateRandomNumber } from "../../helpers/generate.helper";
import { sendMail, emailTemplates } from "../../helpers/mail.helper";
import { issueRefreshToken, rotateRefreshToken, signAccessToken, revokeRefreshTokens, isIssuedBeforePasswordChange, REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { IRegisterUserInput } from "../../interfaces/models/account-user.interface";
import { metadataCache } from "../../helpers/metadata-cache.helper";
import { invalidateAdminDashboardCaches } from "../admin/dashboard.service";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(generateRandomNumber(12), 10);

export const registerUser = async (userData: IRegisterUserInput): Promise<{ success: boolean; status?: number; message: string; tokenUser?: string; user?: typeof AccountUser.prototype }> => {
  const existEmail = await AccountUser.findOne({
    email: String(userData.email || ""),
    deleted: false
  }).select("_id");

  if (existEmail) {
    return { success: false, status: 409, message: "Email is already in use!" };
  }

  const existPhone = await AccountUser.findOne({
    phone: String(userData.phone || ""),
    deleted: false
  }).select("_id");

  if (existPhone) {
    return { success: false, status: 409, message: "Phone number is already in use!" };
  }

  const hashedPassword = await bcrypt.hash(String(userData.password), 10);
  userData.password = hashedPassword;
  userData.search = toSearchText(`${userData.fullName} ${userData.email}`);
  userData.status = "active";

  const newAccount = new AccountUser(userData);
  await newAccount.save();
  invalidateAdminDashboardCaches();

  const tokenUser = signAccessToken({ id: newAccount.id, email: newAccount.email }, "7d");

  return {
    success: true,
    message: "Registration successful!",
    tokenUser,
    user: newAccount
  };
};

export const loginUser = async (email: string, password: string, rememberPassword?: boolean) => {
  const existAccount = await AccountUser.findOne({
    email: email,
    deleted: false
  }).select("_id email password status");

  const checkPassword = await bcrypt.compare(password, existAccount ? `${existAccount.password}` : DUMMY_PASSWORD_HASH);
  if (!existAccount || !checkPassword) {
    return { success: false, status: 401, message: "Invalid email or password!" };
  }

  if (existAccount.status !== "active") {
    return { success: false, status: 403, message: "Account is inactive!" };
  }

  const tokenUser = signAccessToken({ id: existAccount.id, email: existAccount.email }, rememberPassword ? "7d" : "1d");

  let refreshToken: string | undefined;
  if (rememberPassword) {
    refreshToken = await issueRefreshToken(existAccount.id, "user");
  }

  return {
    success: true,
    message: "Login successful!",
    tokenUser,
    refreshToken,
    user: existAccount
  };
};

export const logoutUser = async (refreshToken?: string) => {
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
};

export const createOAuthSession = async (user: { id?: string; _id?: unknown; email?: string }) => {
  const userId = String(user._id || user.id);
  const tokenUser = signAccessToken({ id: userId, email: user.email }, "1d");

  const refreshToken = await issueRefreshToken(userId, "user");
  return {
    tokenUser,
    refreshToken,
    maxAge: 24 * 60 * 60 * 1000,
    refreshMaxAge: REFRESH_TOKEN_TTL_MS
  };
};

export const requestPasswordReset = async (email: string) => {
  const existAccount = await AccountUser.findOne({
    email: email,
    deleted: false,
    status: "active"
  }).select("_id");

  const RESET_REQUESTED_MESSAGE = "If this email is registered, we have sent an OTP code. Please check your inbox!";

  if (!existAccount) {
    return { success: true, message: RESET_REQUESTED_MESSAGE };
  }

  await VerifyOTP.deleteMany({ email, type: "otp-password", expireAt: { $lte: new Date() } });

  const existVerifyOTP = await VerifyOTP.findOne({
    email: email,
    type: "otp-password"
  }).select("_id");

  if (existVerifyOTP) {
    return { success: true, message: RESET_REQUESTED_MESSAGE };
  }

  const otp = generateRandomNumber(6);
  const newRecord = new VerifyOTP({
    email: email,
    otp: otp,
    type: "otp-password",
    expireAt: new Date(Date.now() + 5 * 60 * 1000)
  });
  await newRecord.save();

  try {
    const { subject, html } = await emailTemplates.forgotPasswordOtp(`${otp}`);
    await sendMail(email, subject, html);
  } catch (mailErr) {
    console.error("[forgotPassword] sendMail failed, rolling back OTP:", mailErr);
    await VerifyOTP.deleteOne({ email, type: "otp-password" });
    return { success: false, status: 502, message: "Failed to send OTP email. Please try again." };
  }

  return { success: true, message: RESET_REQUESTED_MESSAGE };
};

export const verifyOtpAndLogin = async (email: string, otp: string) => {
  const existAccount = await AccountUser.findOne({
    email: email,
    deleted: false,
    status: "active"
  }).select("_id email");

  if (!existAccount) {
    return { success: false, status: 400, message: "Invalid or expired OTP code!" };
  }

  const verifyRecord = await consumeOtp({ email, type: "otp-password" }, otp);

  if (!verifyRecord) {
    return { success: false, status: 400, message: "Invalid or expired OTP code!" };
  }

  await AccountUser.updateOne({ _id: existAccount._id }, { $set: { emailVerified: true } });

  const tokenUser = signAccessToken({ id: existAccount.id, email: existAccount.email }, "1d");

  const refreshToken = await issueRefreshToken(existAccount.id, "user");

  return {
    success: true,
    message: "OTP verification successful. Please change your password!",
    tokenUser,
    refreshToken
  };
};

export const resetUserPassword = async (userId?: string, userEmail?: string, newPassword?: string) => {
  if (!userId) {
    return { success: false, status: 401, message: "Please log in!" };
  }
  if (!newPassword) {
    return { success: false, status: 400, message: "Password is required!" };
  }

  const hashPassword = await bcrypt.hash(newPassword, 10);
  await AccountUser.updateOne({ _id: userId }, { password: hashPassword, passwordChangedAt: new Date() });
  await revokeRefreshTokens(userId, "user");
  invalidateUserAuthCache(userId);

  if (userEmail) {
    emailTemplates.passwordChanged(userEmail)
      .then(({ subject, html }) => sendMail(userEmail, subject, html))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`[auth] password-changed notification email failed for ${userEmail} (${msg})`);
      });
  }

  const tokenUser = signAccessToken({ id: userId, email: userEmail });
  const refreshToken = await issueRefreshToken(userId, "user");

  return { success: true, message: "Password changed successfully!", tokenUser, refreshToken };
};

export const invalidateUserAuthCache = (userId?: string) => {
  if (userId) {
    metadataCache.del(`auth:user:${userId}`);
  } else {
    const keys = metadataCache.keys();
    const toDel = keys.filter(k => k.startsWith("auth:user:"));
    if (toDel.length > 0) metadataCache.del(toDel);
  }
};

export const getUserAccountForAuth = async (userId: string, email: string, issuedAtMs?: number) => {
  const cacheKey = `auth:user:${userId}`;
  const cached = metadataCache.get<{
    id: string;
    fullName: string;
    email: string;
    phone?: string;
    avatar?: string;
    addressList: unknown[];
    totalPoint: number;
    usedPoint: number;
    passwordChangedAt?: Date;
  }>(cacheKey);
  if (cached) {
    if (cached.email !== email || isIssuedBeforePasswordChange(issuedAtMs, cached.passwordChangedAt)) return null;
    return cached;
  }

  const existAccount = await AccountUser.findOne({
    _id: userId,
    email,
    deleted: false,
    status: "active"
  }).select("_id fullName email phone avatar totalPoint usedPoint status passwordChangedAt");

  if (!existAccount) return null;

  if (isIssuedBeforePasswordChange(issuedAtMs, existAccount.passwordChangedAt)) return null;

  const addressList = await UserAddress.find({ userId: existAccount.id }).select("_id fullName phone address longitude latitude isDefault").sort({ createdAt: "desc" });

  const result = {
    id: existAccount.id,
    fullName: existAccount.fullName,
    email: existAccount.email,
    phone: existAccount.phone,
    avatar: existAccount.avatar,
    addressList,
    totalPoint: existAccount.totalPoint || 0,
    usedPoint: existAccount.usedPoint || 0,
    passwordChangedAt: existAccount.passwordChangedAt
  };

  metadataCache.set(cacheKey, result, 60);
  return result;
};


export const handleUserRefreshTokenRotation = async (
  refreshTokenValue: string,
  res: Response
): Promise<{ id: string; email?: string } | null> => {
  const storedToken = await RefreshToken.findOne({
    token: refreshTokenValue,
    role: "user",
    expiresAt: { $gt: new Date() }
  });

  if (!storedToken) {
    res.clearCookie("refreshToken", COOKIE_OPTS);
    return null;
  }

  const account = await AccountUser.findOne({
    _id: storedToken.userId,
    deleted: false,
    status: "active"
  }).select("_id email status");

  if (!account) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    res.clearCookie("refreshToken", COOKIE_OPTS);
    return null;
  }

  const outcome = await rotateRefreshToken({
    storedToken,
    account: { id: account.id, email: account.email },
    role: "user",
    accessTokenCookieName: "tokenUser",
    refreshTokenCookieName: "refreshToken",
    res,
  });

  if (outcome === "revoked") return null;

  return { id: account.id, email: account.email };
};
