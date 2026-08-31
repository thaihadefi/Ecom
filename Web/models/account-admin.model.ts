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
    isSuperAdmin: { type: Boolean, default: false },
    lastLoginAt: Date,
    lastSeenAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

schema.index({ deleted: 1 });
schema.index({ search: 1 });
schema.index({ status: 1 }, { partialFilterExpression: { deleted: false } });
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted: false }, name: "email_active" });

import { IAccountAdmin } from '../interfaces/models/account-admin.interface';

const AccountAdmin = mongoose.model<IAccountAdmin>('AccountAdmin', schema, "accounts-admin");

export default AccountAdmin;
