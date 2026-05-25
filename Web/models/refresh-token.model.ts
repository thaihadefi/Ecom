import mongoose from "mongoose";

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

// Auto-delete expired documents
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("RefreshToken", schema, "refresh-tokens");

export default RefreshToken;