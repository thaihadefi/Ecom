import { Response } from 'express';
import { toSearchText } from '../../helpers/slugify.helper';
import AccountUser from "../../models/account-user.model";
import UserAddress from "../../models/user-address.model";
import RefreshToken from "../../models/refresh-token.model";
import VerifyOTP from "../../models/verify-otp.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateRandomNumber } from "../../helpers/generate.helper";
import { sendMail, emailTemplates } from "../../helpers/mail.helper";
import { issueRefreshToken, rotateRefreshToken, REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { IRegisterUserInput } from "../../interfaces/models/account-user.interface";

export const registerUser = async (userData: IRegisterUserInput): Promise<{ success: boolean; message: string; tokenUser?: string; user?: typeof AccountUser.prototype }> => {
  const existEmail = await AccountUser.findOne({
    email: String(userData.email || ""),
    deleted: false
  }).select("_id");

  if (existEmail) {
    return { success: false, message: "Email is already in use!" };
  }

  const existPhone = await AccountUser.findOne({
    phone: String(userData.phone || ""),
    deleted: false
  }).select("_id");

  if (existPhone) {
    return { success: false, message: "Phone number is already in use!" };
  }

  const hashedPassword = await bcrypt.hash(String(userData.password), 10);
  userData.password = hashedPassword;
  userData.search = toSearchText(`${userData.fullName} ${userData.email}`);
  userData.status = "active";

  const newAccount = new AccountUser(userData);
  await newAccount.save();

  const tokenUser = jwt.sign(
    { id: newAccount.id, email: newAccount.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: "7d" }
  );

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

  if (!existAccount) {
    return { success: false, message: "Account does not exist!" };
  }

  const checkPassword = await bcrypt.compare(password, `${existAccount.password}`);
  if (!checkPassword) {
    return { success: false, message: "Incorrect password!" };
  }

  if (existAccount.status !== "active") {
    return { success: false, message: "Account is inactive!" };
  }

  const tokenUser = jwt.sign(
    { id: existAccount.id, email: existAccount.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: rememberPassword ? "7d" : "1d" }
  );

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
  const tokenUser = jwt.sign(
    { id: userId, email: user.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: "1d" }
  );

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

  if (!existAccount) {
    return { success: false, message: "Email does not exist!" };
  }

  const existVerifyOTP = await VerifyOTP.findOne({
    email: email,
    type: "otp-password"
  }).select("_id");

  if (existVerifyOTP) {
    return { success: false, message: "Please retry your request after 5 minutes!" };
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
    return { success: false, message: "Failed to send OTP email. Please try again." };
  }

  return { success: true, message: "We have sent the OTP code via email. Please check your inbox!" };
};

export const verifyOtpAndLogin = async (email: string, otp: string) => {
  const existAccount = await AccountUser.findOne({
    email: email,
    deleted: false,
    status: "active"
  }).select("_id email");

  if (!existAccount) {
    return { success: false, message: "Email does not exist!" };
  }

  const verifyRecord = await VerifyOTP.findOneAndDelete({
    email: email,
    otp: `${otp}`,
    type: "otp-password",
    expireAt: { $gt: new Date() }
  });

  if (!verifyRecord) {
    return { success: false, message: "Invalid or expired OTP code!" };
  }

  const tokenUser = jwt.sign(
    { id: existAccount.id, email: existAccount.email },
    `${process.env.JWT_SECRET}`,
    { expiresIn: "1d" }
  );

  const refreshToken = await issueRefreshToken(existAccount.id, "user");

  return {
    success: true,
    message: "OTP verification successful. Please change your password!",
    tokenUser,
    refreshToken
  };
};

export const resetUserPassword = async (userId: string, userEmail?: string, newPassword?: string) => {
  if (!newPassword) {
    return { success: false, message: "Password is required!" };
  }

  const hashPassword = await bcrypt.hash(newPassword, 10);
  await AccountUser.updateOne({ _id: userId }, { password: hashPassword });

  if (userEmail) {
    emailTemplates.passwordChanged(userEmail)
      .then(({ subject, html }) => sendMail(userEmail, subject, html))
      .catch(() => {});
  }

  return { success: true, message: "Password changed successfully!" };
};

export const getUserAccountForAuth = async (userId: string, email: string) => {
  const existAccount = await AccountUser.findOne({
    _id: userId,
    email,
    deleted: false,
    status: "active"
  }).select("_id fullName email phone avatar totalPoint usedPoint status");

  if (!existAccount) return null;

  const addressList = await UserAddress.find({ userId: existAccount.id }).select("_id name phone address province district ward type").sort({ createdAt: "desc" });

  return {
    id: existAccount.id,
    fullName: existAccount.fullName,
    email: existAccount.email,
    phone: existAccount.phone,
    avatar: existAccount.avatar,
    addressList,
    totalPoint: existAccount.totalPoint,
    usedPoint: existAccount.usedPoint
  };
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
