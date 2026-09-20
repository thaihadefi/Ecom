import mongoose from "mongoose";
import { IVerifyOTP } from "../interfaces/models/verify-otp.interface";

const schema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true },
  otp: String,
  type: {
    type: String,
    enum: ["otp-password", "otp-register", "otp-email-change"],
  },
  userId: String,
  newEmail: { type: String, lowercase: true, trim: true },
  attempts: { type: Number, default: 0 },
  expireAt: {
    type: Date,
    expires: 0
  }
}, {
  timestamps: true
});

schema.index({ email: 1, type: 1 }, { unique: true });
schema.index({ userId: 1 });

const VerifyOTP = mongoose.model<IVerifyOTP>('VerifyOTP', schema, "verify-otp");

export default VerifyOTP;
