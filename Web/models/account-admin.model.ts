import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    fullName: String,
    email: String,
    password: String,
    roles: [String],
    status: {
      type: String,
      enum: ["initial", "active", "inactive"], 
    },
    avatar: String,
    search: String,
    isSuperAdmin: { type: Boolean, default: false }, // Only set via seed or manual DB update
    lastLoginAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
  },
  {
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

// Indexes
schema.index({ deleted: 1 });
schema.index({ search: 1 });
// Partial indexes
schema.index({ status: 1 }, { partialFilterExpression: { deleted: false } });
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted: false }, name: "email_active" });

const AccountAdmin = mongoose.model('AccountAdmin', schema, "accounts-admin");

export default AccountAdmin;