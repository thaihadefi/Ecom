import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    adminId: String,
    method: String,
    route: String,
    title: String,
    expireAt: {
      type: Date,
      expires: 0
    }
  },
  {
    timestamps: true,
  }
);

schema.index({ adminId: 1 });
schema.index({ createdAt: -1 });

import { IAdminLog } from '../interfaces/models/admin-log.interface';

const AdminLog = mongoose.model<IAdminLog>('AdminLog', schema, "admin-logs");

export default AdminLog;
