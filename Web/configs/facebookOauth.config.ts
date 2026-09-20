import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { getApiLoginSocial } from "./setting.config";
import { CookieStateStore } from "./oauth-state.config";
import { resolveOAuthUser } from "../services/client/oauth.service";

export const configureFacebookPassport = async (passportInstance: typeof passport) => {
  const apiLoginSocial = await getApiLoginSocial();

  const facebookAppId = apiLoginSocial?.facebookAppId || "placeholder";
  const facebookAppSecret = apiLoginSocial?.facebookAppSecret || "placeholder";
  const facebookCallbackUrl = apiLoginSocial?.facebookCallbackUrl || "http://localhost:3000/auth/facebook/callback";

  passportInstance.use(new FacebookStrategy(
    {
      clientID: `${facebookAppId}`,
      clientSecret: `${facebookAppSecret}`,
      callbackURL: `${facebookCallbackUrl}`,
      profileFields: ["id", "displayName", "emails"],
      store: new CookieStateStore(),
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const result = await resolveOAuthUser({
          provider: "facebook",
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          emailVerified: true,
          displayName: profile.displayName,
        });

        if (!result.user) {
          done(null, false, { message: result.reason });
          return;
        }
        done(null, result.user);
      } catch (error) {
        done(error, undefined);
      }
    }
  ));
};
