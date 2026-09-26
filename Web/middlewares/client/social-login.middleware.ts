import { NextFunction, Request, Response } from "express";
import { getApiLoginSocial } from "../../configs/setting.config";
import { ISettingApiLoginSocial } from "../../interfaces/models/setting.interface";

type SocialProvider = "google" | "facebook";

const filled = (...values: Array<string | undefined>) => values.every((v) => Boolean(v && v.trim()));

// A social login is offered only once its keys are saved in Settings > Social login.
export const socialLoginAvailability = (api: ISettingApiLoginSocial): Record<SocialProvider, boolean> => ({
  google: filled(api.googleClientId, api.googleClientSecret),
  facebook: filled(api.facebookAppId, api.facebookAppSecret),
});

export const socialLoginOptions = async (_req: Request, res: Response, next: NextFunction) => {
  res.locals.socialLogin = socialLoginAvailability(await getApiLoginSocial());
  next();
};

// Sends the visitor back to the login page instead of an OAuth error when a provider is not set up.
export const requireSocialLogin = (provider: SocialProvider) =>
  async (_req: Request, res: Response, next: NextFunction) => {
    if (socialLoginAvailability(await getApiLoginSocial())[provider]) {
      next();
      return;
    }
    res.redirect("/auth/login");
  };
