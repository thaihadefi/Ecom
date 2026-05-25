import { toSearchText } from '../helpers/slugify.helper';
import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import AccountUser from "../models/account-user.model";
import { getApiLoginSocial } from "./setting.config";

// Function receiving passport to configure
export const configureFacebookPassport = async (passportInstance: typeof passport) => {
  const apiLoginSocial = await getApiLoginSocial();
  
  const facebookAppId = apiLoginSocial?.facebookAppId || "placeholder";
  const facebookAppSecret = apiLoginSocial?.facebookAppSecret || "placeholder";
  const facebookCallbackUrl = apiLoginSocial?.facebookCallbackUrl || "http://localhost:3000/auth/facebook/callback";

  // Set up Facebook login strategy
  passportInstance.use(new FacebookStrategy(
    {
      clientID: `${facebookAppId}`, // Facebook App ID
      clientSecret: `${facebookAppSecret}`, // Secret key
      callbackURL: `${facebookCallbackUrl}`, // Callback URL after login
      profileFields: ["id", "displayName", "emails"], // Request fields
    },
    // Callback function when Facebook authentication is successful
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Facebook account email is not available."), undefined);
        }

        // Find user by email in database
        const existingUser = await AccountUser.findOne({ email });
        if (existingUser) {
          if (!existingUser.status) {
            existingUser.status = "active";
            await existingUser.save();
          }
          return done(null, existingUser);
        }
        
        // If not exists, create new user
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

        // Return newly created user to Passport
        done(null, newUser);
      } catch (error) {
        // If error, notify Passport
        done(error, undefined);
      }
    }
  ));

   // Save user.id to session
  passportInstance.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Retrieve user from database with session
  passportInstance.deserializeUser(async (id: string, done) => {
    try {
      const user = await AccountUser.findById(id).select("-password");
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};