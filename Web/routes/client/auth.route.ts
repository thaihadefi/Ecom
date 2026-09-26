import { Router } from "express";
import * as authController from "../../controllers/client/auth.controller";
import * as authValidate from "../../validates/client/auth.validate";
import passport from "passport";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import { pageRateLimit, MINUTE, HOUR } from "../../middlewares/rate-limit.middleware";
import { emailOf } from "../../helpers/rate-limit.helper";
import { requireSocialLogin, socialLoginOptions } from "../../middlewares/client/social-login.middleware";

const router = Router();

router.get('/register', authController.register);

router.get('/login', socialLoginOptions, authController.login);

const oauthLimit = pageRateLimit({ windowMs: 15 * MINUTE, max: 30 });
const oauthOptions = { session: false, failureRedirect: '/auth/login?oauthError=email' };

router.get('/google', oauthLimit, requireSocialLogin("google"), passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get('/google/callback', requireSocialLogin("google"), passport.authenticate('google', oauthOptions), authController.callbackGoogle);

router.get('/facebook', oauthLimit, requireSocialLogin("facebook"), passport.authenticate('facebook', {
  scope: ['email'],
  session: false,
}));

router.get('/facebook/callback', requireSocialLogin("facebook"), passport.authenticate('facebook', oauthOptions), authController.callbackFacebook);

router.get('/forgot-password', authController.forgotPassword);

router.get('/otp-password', authController.otpPassword);

router.get('/reset-password', authController.resetPassword);

export default router;

export const sessionApi = Router();

sessionApi.post(
  '/',
  pageRateLimit({ windowMs: 15 * MINUTE, max: 30 }, { windowMs: 15 * MINUTE, max: 10, key: (req) => `${req.ip}|${emailOf(req)}` }),
  authValidate.loginPost,
  authController.loginPost
);

sessionApi.delete('/current', authController.logout);

export const customerApi = Router();

customerApi.post(
  '/',
  pageRateLimit({ windowMs: HOUR, max: 10 }),
  authValidate.registerPost,
  authController.registerPost
);

export const passwordResetApi = Router();

passwordResetApi.post(
  '/',
  pageRateLimit({ windowMs: 15 * MINUTE, max: 5 }, { windowMs: HOUR, max: 3, key: emailOf }),
  authValidate.forgotPasswordPost,
  authController.forgotPasswordPost
);

passwordResetApi.post(
  '/verification',
  pageRateLimit({ windowMs: 15 * MINUTE, max: 20 }),
  authValidate.otpPasswordPost,
  authController.otpPasswordPost
);

export const passwordApi = Router();

passwordApi.put(
  '/',
  authMiddleware.loggedIn,
  pageRateLimit({ windowMs: 15 * MINUTE, max: 5, key: (req) => req.res?.locals.accountUser?.id || req.ip }),
  authValidate.resetPasswordPost,
  authController.resetPasswordPost
);
