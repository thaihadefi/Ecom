import AccountUser from "../../models/account-user.model";
import { IAccountUser } from "../../interfaces/models/account-user.interface";
import { toSearchText } from "../../helpers/slugify.helper";
import { revokeRefreshTokens } from "../../helpers/token-rotation.helper";
import { invalidateAdminDashboardCaches } from "../admin/dashboard.service";
import { invalidateUserAuthCache } from "./auth.service";

export type OAuthProvider = "google" | "facebook";

export interface OAuthProfileInput {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export type OAuthResult =
  | { user: IAccountUser }
  | { user?: undefined; reason: "no-email" | "unverified-email" | "inactive" | "provider-mismatch" };

const providerField = (provider: OAuthProvider): "googleId" | "facebookId" =>
  provider === "google" ? "googleId" : "facebookId";

export const resolveOAuthUser = async (input: OAuthProfileInput): Promise<OAuthResult> => {
  const email = input.email?.trim();
  if (!email) return { reason: "no-email" };

  const idField = providerField(input.provider);
  const existing = await AccountUser.findOne({ email, deleted: false });

  if (existing) {
    if (existing.status === "inactive") return { reason: "inactive" };

    const linkedId = existing[idField];
    if (linkedId) {
      if (linkedId !== input.providerId) return { reason: "provider-mismatch" };
    } else {
      if (!input.emailVerified) return { reason: "unverified-email" };

      const update: Record<string, unknown> = {
        $set: { [idField]: input.providerId, emailVerified: true, status: existing.status || "active" },
      };
      if (existing.password && existing.emailVerified !== true) {
        update.$unset = { password: 1 };
        (update.$set as Record<string, unknown>).passwordChangedAt = new Date();
        await revokeRefreshTokens(existing.id, "user");
      }
      await AccountUser.updateOne({ _id: existing._id }, update);
      invalidateUserAuthCache(existing.id);
      existing[idField] = input.providerId;
    }

    if (!existing.status) existing.status = "active";
    return { user: existing };
  }

  const fullName = input.displayName || email;
  const newUser = new AccountUser({
    [idField]: input.providerId,
    fullName,
    email,
    search: toSearchText(`${fullName} ${email}`),
    emailVerified: true,
    status: "active",
  });
  await newUser.save();
  invalidateAdminDashboardCaches();
  return { user: newUser };
};
