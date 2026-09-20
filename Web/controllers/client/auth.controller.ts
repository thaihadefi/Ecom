import { Request, Response } from "express";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import { REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";
import { IAccountUser } from "../../interfaces/models/account-user.interface";
import * as authService from "../../services/client/auth.service";
import { resultStatus, sendCaughtError } from "../../helpers/http-response.helper";
import { accessTokenBody } from "../../helpers/access-token.helper";

export const register = async (_req: Request, res: Response) => {
  res.render("client/pages/register", {
    pageTitle: "Register"
  });
};

export const registerPost = async (req: Request, res: Response) => {
  try {
    const result = await authService.registerUser(req.body);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    if (result.tokenUser) {
      res.cookie("tokenUser", result.tokenUser, {
        ...COOKIE_OPTS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    res.json({
      code: "success",
      message: result.message
    });
  } catch (error) {
    console.error("registerPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const login = async (req: Request, res: Response) => {
  const oauthError = req.query.oauthError === "email"
    ? "We could not sign you in with that social account. It needs a verified email address and must not be a deactivated account. Please use another account or sign in with email/password."
    : "";

  res.render("client/pages/login", {
    pageTitle: "Login",
    oauthError
  });
};

export const loginPost = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberPassword } = req.body;

    const result = await authService.loginUser(email, password, rememberPassword);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    if (result.tokenUser) {
      res.cookie("tokenUser", result.tokenUser, {
        ...COOKIE_OPTS,
        maxAge: rememberPassword ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });
    }

    if (result.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, {
        ...COOKIE_OPTS,
        maxAge: REFRESH_TOKEN_TTL_MS,
      });
    }

    res.json({
      code: "success",
      message: result.message,
      ...(result.tokenUser ? accessTokenBody(result.tokenUser) : {})
    });
  } catch (error) {
    console.error("loginPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const logout = async (req: Request, res: Response) => {
  await authService.logoutUser(req.cookies.refreshToken);
  res.clearCookie("refreshToken", COOKIE_OPTS);
  res.clearCookie("tokenUser", COOKIE_OPTS);
  res.json({ code: "success", message: "Logged out!" });
};

export const callbackGoogle = async (req: Request, res: Response) => {
  const user = req.user as IAccountUser;
  const session = await authService.createOAuthSession(user);

  res.cookie("tokenUser", session.tokenUser, {
    ...COOKIE_OPTS,
    maxAge: session.maxAge,
  });

  res.cookie("refreshToken", session.refreshToken, {
    ...COOKIE_OPTS,
    maxAge: session.refreshMaxAge,
  });

  res.redirect('/');
};

export const callbackFacebook = async (req: Request, res: Response) => {
  const user = req.user as IAccountUser;
  const session = await authService.createOAuthSession(user);

  res.cookie("tokenUser", session.tokenUser, {
    ...COOKIE_OPTS,
    maxAge: session.maxAge,
  });

  res.cookie("refreshToken", session.refreshToken, {
    ...COOKIE_OPTS,
    maxAge: session.refreshMaxAge,
  });

  res.redirect('/');
};

export const forgotPassword = async (_req: Request, res: Response) => {
  res.render("client/pages/forgot-password", {
    pageTitle: "Forgot Password"
  });
};

export const forgotPasswordPost = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message
    });
  } catch (error) {
    console.error("forgotPasswordPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const otpPassword = async (req: Request, res: Response) => {
  const { email } = req.query;

  res.render("client/pages/otp-password", {
    pageTitle: "Verify OTP",
    email: email
  });
};

export const otpPasswordPost = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyOtpAndLogin(email, otp);

    if (!result.success) {
      res.status(resultStatus(result)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    if (result.tokenUser) {
      res.cookie("tokenUser", result.tokenUser, {
        ...COOKIE_OPTS,
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    if (result.refreshToken) {
      res.cookie("refreshToken", result.refreshToken, {
        ...COOKIE_OPTS,
        maxAge: REFRESH_TOKEN_TTL_MS,
      });
    }

    res.json({
      code: "success",
      message: result.message,
      ...(result.tokenUser ? accessTokenBody(result.tokenUser) : {})
    });
  } catch (error) {
    console.error("otpPasswordPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};

export const resetPassword = async (_req: Request, res: Response) => {
  res.render("client/pages/reset-password", {
    pageTitle: "Reset Password"
  });
};

export const resetPasswordPost = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const userId = res.locals.accountUser?.id;
    const userEmail = res.locals.accountUser?.email;

    const result = await authService.resetUserPassword(userId, userEmail, password);

    if (result.success && result.tokenUser && result.refreshToken) {
      res.cookie("tokenUser", result.tokenUser, { ...COOKIE_OPTS, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("refreshToken", result.refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_TOKEN_TTL_MS });
    }

    res.status(resultStatus(result)).json({
      code: result.success ? "success" : "error",
      message: result.message,
      ...(result.success && result.tokenUser ? accessTokenBody(result.tokenUser) : {})
    });
  } catch (error) {
    console.error("resetPasswordPost error:", error);
    sendCaughtError(res, error, "Invalid data!");
  }
};
