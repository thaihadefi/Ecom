import { toSearchText } from '../../helpers/slugify.helper';
import { Request, Response } from "express";
import AccountUser from "../../models/account-user.model";
import RefreshToken from "../../models/refresh-token.model";
import bcrypt from "bcryptjs";
import { COOKIE_OPTS } from '../../configs/cookie.config';
import jwt from "jsonwebtoken";
import { generateRandomNumber } from "../../helpers/generate.helper";
import VerifyOTP from "../../models/verify-otp.model";
import { sendMail, emailTemplates } from "../../helpers/mail.helper";
import { issueRefreshToken, REFRESH_TOKEN_TTL_MS } from "../../helpers/token-rotation.helper";

export const register = async (req: Request, res: Response) => {
  res.render("client/pages/register", {
    pageTitle: "Register"
  });
}

export const registerPost = async (req: Request, res: Response) => {
  try {
    const existEmail = await AccountUser.findOne({
      email: req.body.email,
      deleted: false
    }).select("_id")

    if(existEmail) {
      res.json({
        code: "error",
        message: "Email is already in use!"
      });
      return;
    }

    const existPhone = await AccountUser.findOne({
      phone: req.body.phone,
      deleted: false
    }).select("_id")

    if(existPhone) {
      res.json({
        code: "error",
        message: "Phone number is already in use!"
      });
      return;
    }

    req.body.password = await bcrypt.hash(req.body.password, 10);

    req.body.status = "active";

    req.body.search = toSearchText(`${req.body.fullName} ${req.body.email} ${req.body.phone}`);

    const newAccount = new AccountUser(req.body);
    await newAccount.save();

    const tokenUser = jwt.sign(
      { id: newAccount.id, email: newAccount.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "7d"
      }
    );

    res.cookie("tokenUser", tokenUser, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      code: "success",
      message: "Registration successful!"
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
}

export const login = async (req: Request, res: Response) => {
  const oauthError = req.query.oauthError === "email"
    ? "Your social account did not provide an email address. Please use another account or sign up with email/password."
    : "";

  res.render("client/pages/login", {
    pageTitle: "Login",
    oauthError
  });
}

export const loginPost = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberPassword } = req.body;

    const existAccount = await AccountUser.findOne({
      email: email,
      deleted: false
    }).select("_id email password status")

    if(!existAccount) {
      res.json({
        code: "error",
        message: "Account does not exist!"
      });
      return;
    }

    const checkPassword = await bcrypt.compare(password, `${existAccount.password}`);

    if(!checkPassword) {
      res.json({
        code: "error",
        message: "Incorrect password!"
      });
      return;
    }

    if(existAccount.status != "active") {
      res.json({
        code: "error",
        message: "Account is inactive!"
      });
      return;
    }

    const tokenUser = jwt.sign(
      { id: existAccount.id, email: existAccount.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: rememberPassword ? "7d" : "1d"
      }
    );

    res.cookie("tokenUser", tokenUser, {
      ...COOKIE_OPTS,
      maxAge: rememberPassword ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    if (rememberPassword) {
      const refreshToken = await issueRefreshToken(existAccount.id, "user");
      res.cookie("refreshToken", refreshToken, {
        ...COOKIE_OPTS,
        maxAge: REFRESH_TOKEN_TTL_MS,
      });
    }

    res.json({
      code: "success",
      message: "Login successful!"
    });
  } catch (error) {
    res.json({
      code: "error",
      message: "Invalid data!"
    });
  }
}

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
  res.clearCookie("refreshToken", COOKIE_OPTS);
  res.clearCookie("tokenUser", COOKIE_OPTS);
  res.redirect("/auth/login");
}

export const callbackGoogle = async (req: Request, res: Response) => {
  const user = req.user as any;

  const tokenUser = jwt.sign(
      { id: user.id, email: user.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1d"
      }
    );

  res.cookie("tokenUser", tokenUser, {
    ...COOKIE_OPTS,
    maxAge: 24 * 60 * 60 * 1000,
  });

  const refreshToken = await issueRefreshToken(user.id, "user");
  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTS,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });

  res.redirect('/');
}

export const callbackFacebook = async (req: Request, res: Response) => {
  const user = req.user as any;

  const tokenUser = jwt.sign(
      { id: user.id, email: user.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1d"
      }
    );

  res.cookie("tokenUser", tokenUser, {
    ...COOKIE_OPTS,
    maxAge: 24 * 60 * 60 * 1000,
  });

  const refreshToken = await issueRefreshToken(user.id, "user");
  res.cookie("refreshToken", refreshToken, {
    ...COOKIE_OPTS,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });

  res.redirect('/');
}

export const forgotPassword = async (req: Request, res: Response) => {
  res.render("client/pages/forgot-password", {
    pageTitle: "Forgot Password"
  });
}

export const forgotPasswordPost = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Check if email exists in DB
    const existAccount = await AccountUser.findOne({
      email: email,
      deleted: false,
      status: "active"
    }).select("_id")

    if(!existAccount) {
      res.json({
        code: "error",
        message: "Email does not exist!"
      });
      return;
    }

    // Generate OTP code
    const otp = generateRandomNumber(6);

    // Check if email already exists in VerifyOTP list
    const existVerifyOTP = await VerifyOTP.findOne({
      email: email,
      type: "otp-password"
    }).select("_id");

    if(existVerifyOTP) {
      res.json({
        code: "error",
        message: "Please retry your request after 5 minutes!"
      })
      return;
    }

    // Save to DB (expires in 5 minutes)
    const newRecord = new VerifyOTP({
      email: email,
      otp: otp,
      type: "otp-password",
      expireAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    await newRecord.save();

    // Send OTP email (critical — rollback if it fails)
    const { subject, html } = await emailTemplates.forgotPasswordOtp(`${otp}`);
    try {
      await sendMail(email, subject, html);
    } catch (mailErr) {
      console.error("[forgotPassword] sendMail failed, rolling back OTP:", mailErr);
      await VerifyOTP.deleteOne({ email, type: "otp-password" });
      res.json({ code: "error", message: "Failed to send OTP email. Please try again." });
      return;
    }

    res.json({
      code: "success",
      message: "We have sent the OTP code via email. Please check your inbox!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const otpPassword = async (req: Request, res: Response) => {
  const { email } = req.query;

  res.render("client/pages/otp-password", {
    pageTitle: "Verify OTP",
    email: email
  });
}

export const otpPasswordPost = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const existAccount = await AccountUser.findOne({
      email: email,
      deleted: false,
      status: "active"
    }).select("_id")

    if(!existAccount) {
      res.json({
        code: "error",
        message: "Email does not exist!"
      })
      return;
    }

    const verifyRecord = await VerifyOTP.findOneAndDelete({
      email: email,
      otp: `${otp}`,
      type: "otp-password",
      expireAt: { $gt: new Date() }
    });

    if (!verifyRecord) {
      res.json({
        code: "error",
        message: "Invalid or expired OTP code!"
      });
      return;
    }

    const tokenUser = jwt.sign(
      { id: existAccount.id, email: existAccount.email },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1d"
      }
    );

    res.cookie("tokenUser", tokenUser, {
      ...COOKIE_OPTS,
      maxAge: 24 * 60 * 60 * 1000,
    });

    const refreshToken = await issueRefreshToken(existAccount.id, "user");
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });

    res.json({
      code: "success",
      message: "OTP verification successful. Please change your password!"
    });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}

export const resetPassword = async (req: Request, res: Response) => {
  res.render("client/pages/reset-password", {
    pageTitle: "Reset Password"
  });
}

export const resetPasswordPost = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const userId = res.locals.accountUser.id;

    const hashPassword = await bcrypt.hash(password, 10);

    await AccountUser.updateOne({ _id: userId }, { password: hashPassword });

    // Notify account owner (fire-and-forget)
    const userEmail = res.locals.accountUser?.email;
    if (userEmail) {
      emailTemplates.passwordChanged(userEmail)
        .then(({ subject, html }) => sendMail(userEmail, subject, html))
        .catch(() => {});
    }

    res.json({ code: "success", message: "Password changed successfully!" });
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid data!"
    })
  }
}