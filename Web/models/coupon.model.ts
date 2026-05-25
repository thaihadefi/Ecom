import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: String, // Coupon code
    name: String, // Coupon name
    description: String, // Description
    typeDiscount: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    value: Number, // Discount value (10%, 10000 VND,...)
    minOrderValue: Number, // Minimum order value to apply
    maxDiscountValue: Number, // Maximum discount amount (if type = percentage)
    usageLimit: Number, // Usage limit count
    usedCount: {
      type: Number,
      default: 0
    }, // Count of times used
    startDate: Date, // Start date of coupon validity
    endDate: Date, // Expiration date
    typeDisplay: {
      type: String,
      enum: ["public", "private"], 
      default: "private"
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
    },
    search: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date
  },
  {
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

schema.index({ code: 1, deleted: 1, status: 1 });
schema.index({ deleted: 1 });
schema.index({ endDate: 1 });
schema.index({ deletedAt: -1 }, { partialFilterExpression: { deleted: true } });

schema.index({ search: 1 });

const Coupon = mongoose.model('Coupon', schema, "coupons");

export default Coupon;