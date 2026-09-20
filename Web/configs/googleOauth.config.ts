import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { getApiLoginSocial } from "./setting.config";
import { CookieStateStore } from "./oauth-state.config";
import { resolveOAuthUser } from "../services/client/oauth.service";

export const configureGooglePassport = async function (
  passportInstance: typeof passport
) {
  const apiLoginSocial = await getApiLoginSocial();

  const googleClientId = apiLoginSocial?.googleClientId || "placeholder";
  const googleClientSecret = apiLoginSocial?.googleClientSecret || "placeholder";
  const googleCallbackUrl = apiLoginSocial?.googleCallbackUrl || "http://localhost:3000/auth/google/callback";

  passportInstance.use(
    new GoogleStrategy(
      {
        clientID: `${googleClientId}`,
        clientSecret: `${googleClientSecret}`,
        callbackURL: `${googleCallbackUrl}`,
        store: new CookieStateStore(),
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const primaryEmail = profile.emails?.[0] as { value?: string; verified?: boolean | string } | undefined;
          const rawJson = (profile as { _json?: { email_verified?: boolean | string } })._json;
          const verified = [primaryEmail?.verified, rawJson?.email_verified].some((flag) => flag === true || flag === "true");

          const result = await resolveOAuthUser({
            provider: "google",
            providerId: profile.id,
            email: primaryEmail?.value,
            emailVerified: verified,
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
    )
  );
};
