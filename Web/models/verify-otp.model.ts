import mongoose from "mongoose";

const schema = new mongoose.Schema({
  email: String,
  otp: String,
  type: {
    type: String,
    enum: ["otp-password", "otp-register", "otp-email-change"],
  },
  userId: String,
  newEmail: String,
  expireAt: {
    type: Date,
    expires: 0
  }
}, {
  timestamps: true // Automatically generate createdAt and updatedAt fields
});

schema.index({ email: 1, type: 1 }, { unique: true });
schema.index({ userId: 1 });

const VerifyOTP = mongoose.model('VerifyOTP', schema, "verify-otp");

export default VerifyOTP;