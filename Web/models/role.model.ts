import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    description: String,
    permissions: [String],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive"
    },
    search: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  {
    timestamps: true,
  }
);

schema.index({ deleted: 1 });
schema.index({ status: 1, deleted: 1 });
schema.index({ deletedAt: -1 }, { partialFilterExpression: { deleted: true } });

schema.index({ search: 1 });

import { IRole } from '../interfaces/models/role.interface';

const Role = mongoose.model<IRole>('Role', schema, "roles");

export default Role;
