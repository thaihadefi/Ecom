import { Document } from "mongoose";

export interface IVerifyOTP extends Document {
  id?: string;
  email?: string;
  otp?: string;
  type?: "otp-password" | "otp-register" | "otp-email-change";
  userId?: string;
  newEmail?: string;
  expireAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
