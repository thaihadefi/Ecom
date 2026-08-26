import { toSearchText } from '../helpers/slugify.helper';
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import AccountUser from "../models/account-user.model";
import { getApiLoginSocial } from "./setting.config";

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
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Facebook account email is not available."), undefined);
        }

        const existingUser = await AccountUser.findOne({ email });
        if (existingUser) {
          if (!existingUser.status) {
            existingUser.status = "active";
            await existingUser.save();
          }
          return done(null, existingUser);
        }

  const fullName = profile.displayName;
        const search = toSearchText(`${fullName} ${email}`)

        const newUser = new AccountUser({
          facebookId: profile.id,
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
  ));

  passportInstance.serializeUser((user: { id?: string }, done) => {
    done(null, user.id);
  });

  passportInstance.deserializeUser(async (id: string, done) => {
    try {
      const user = await AccountUser.findById(id).select("-password");
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
