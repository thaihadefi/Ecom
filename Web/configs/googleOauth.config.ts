import { toSearchText } from '../helpers/slugify.helper';
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import AccountUser from "../models/account-user.model";
import { getApiLoginSocial } from "./setting.config";

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
      },
      // Callback function when google authentication is successful
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = (profile.emails as any)?.[0]?.value;
          if (!email) {
            return done(new Error("Google account email is not available."), undefined);
          }

          const existingUser = await AccountUser.findOne({
            email: email
          });
          if (existingUser) {
            if (!existingUser.status) {
              existingUser.status = "active";
              await existingUser.save();
            }
            return done(null, existingUser);
          }

          const fullName = profile.displayName;
          const search = toSearchText(`${fullName} ${email}`);

          const newUser = new AccountUser({
            googleId: profile.id,
            fullName: fullName,
            email: email,
            search: search,
            status: "active"
          });
          await newUser.save();
          done(null, newUser);
        } catch (error) {
          done(error, undefined);
        }
      }
    )
  );

  passportInstance.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passportInstance.deserializeUser(async (id, done) => {
    try {
      const user = await AccountUser.findById(id).select("-password");
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
