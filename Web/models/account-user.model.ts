import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      default: ""
    },
    facebookId: {
      type: String,
      default: ""
    },
    fullName: String,
    email: String,
    phone: String,
    password: String,
    status: {
      type: String,
      enum: ["active", "inactive"], 
    },
    avatar: String,
    totalPoint: {
      type: Number,
      default: 0 // Accumulated total points
    },
    usedPoint: {
      type: Number,
      default: 0 // Used points count
    },
    search: String,
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
schema.index({ phone: 1 });
schema.index({ deleted: 1 });
schema.index({ status: 1 });
schema.index({ googleId: 1 });
schema.index({ facebookId: 1 });
schema.index({ search: 1 });
// Partial indexes
schema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted: false }, name: "email_active" });
schema.index({ createdAt: -1 }, { partialFilterExpression: { deleted: false } });

const AccountUser = mongoose.model('AccountUser', schema, "accounts-user");

export default AccountUser;