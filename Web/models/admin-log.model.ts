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
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

schema.index({ adminId: 1 });
schema.index({ createdAt: -1 });

const AdminLog = mongoose.model('AdminLog', schema, "admin-logs");

export default AdminLog;