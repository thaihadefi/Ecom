import mongoose from "mongoose";
import { IRefreshToken } from "../interfaces/models/refresh-token.interface";

const schema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    rotatedAt: { type: Date }
  },
  {
    timestamps: true,
  }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model<IRefreshToken>("RefreshToken", schema, "refresh-tokens");

export default RefreshToken;
