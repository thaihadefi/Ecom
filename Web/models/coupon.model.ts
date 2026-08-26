import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: String,
    name: String,
    description: String,
    typeDiscount: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    value: Number,
    minOrderValue: Number,
    maxDiscountValue: Number,
    usageLimit: Number,
    usedCount: {
      type: Number,
      default: 0
    },
    startDate: Date,
    endDate: Date,
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
    timestamps: true,
  }
);

schema.index({ code: 1, deleted: 1, status: 1 });
schema.index({ deleted: 1 });
schema.index({ endDate: 1 });
schema.index({ deletedAt: -1 }, { partialFilterExpression: { deleted: true } });

schema.index({ search: 1 });

import { ICoupon } from '../interfaces/models/coupon.interface';

const Coupon = mongoose.model<ICoupon>('Coupon', schema, "coupons");

export default Coupon;
