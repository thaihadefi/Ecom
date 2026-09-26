import VerifyOTP from "../models/verify-otp.model";
import { IVerifyOTP } from "../interfaces/models/verify-otp.interface";

export const OTP_MAX_ATTEMPTS = 5;

export const consumeOtp = async (
  filter: { email?: string; userId?: string; type: "otp-password" | "otp-register" | "otp-email-change" },
  otp: string,
): Promise<IVerifyOTP | null> => {
  const record = await VerifyOTP.findOneAndUpdate(
    {
      ...filter,
      expireAt: { $gt: new Date() },
      $or: [{ attempts: { $lt: OTP_MAX_ATTEMPTS } }, { attempts: { $exists: false } }],
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!record) return null;

  if (record.otp === `${otp}`) {
    await VerifyOTP.deleteOne({ _id: record._id });
    return record;
  }

  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await VerifyOTP.deleteOne({ _id: record._id });
  }
  return null;
};
