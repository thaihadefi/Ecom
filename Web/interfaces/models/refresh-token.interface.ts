import { Document } from "mongoose";

export interface IRefreshToken extends Document {
  id?: string;
  userId: string;
  token: string;
  role: "user" | "admin";
  expiresAt: Date;
  used: boolean;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
