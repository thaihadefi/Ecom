import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: String,
    code: String,
    fullName: String,
    phone: String,
    address: String,
    longitude: Number,
    latitude: Number,
    note: String,
    items: [
      {
        productId: String,
        quantity: Number,
        price: Number,
        variant: [String],
        rawVariant: [
          {
            attrId: String,
            label: String,
            value: String,
            _id: false
          }
        ],
        image: String,
        name: String
      }
    ],
    subTotal: Number,
    coupon: String,
    discount: Number,
    total: Number,
    paymentMethod: {
      type: String,
      enum: [
        "money",
        "vnpay",
        "zalopay"
      ],
      default: "money"
    },
    paymentStatus: {
      type: String,
      enum: [
        "unpaid",
        "paid",
        "refunded"
      ],
      default: "unpaid"
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipping",
        "completed",
        "cancelled",
        "returned",
      ],
      default: "pending",
    },
    shipping: {
      goshipOrderId: String,
      carrierName: String,
      carrierCode: String,
      fee: Number,
      cod: Number
    },
    usedPoint: {
      type: Number,
      default: 0
    },
    pointDiscount: {
      type: Number,
      default: 0
    },
    pointEarned: {
      type: Number,
      default: 0
    },
    isAnomalous: {
      type: Boolean,
      default: false
    },
    anomalyScore: {
      type: Number,
      default: 0
    },
    anomalyReason: String,
    anomalyDismissedAt: Date,
    anomalyScoredAt: Date,
    ip: String,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true,
  }
);

schema.index({ userId: 1 });
schema.index({ code: 1 }, { unique: true });
schema.index({ paymentStatus: 1 });
schema.index({ orderStatus: 1 });
schema.index({ deleted: 1 });
schema.index({ createdAt: -1 });
schema.index({ paymentStatus: 1, orderStatus: 1, deleted: 1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ deleted: 1, createdAt: -1 });
// Matches getFlaggedOrders' filter+sort shape.
schema.index({ isAnomalous: 1, deleted: 1, anomalyScore: -1, createdAt: -1 });
schema.index({ phone: 1, createdAt: -1 });
schema.index({ coupon: 1, createdAt: -1 });
schema.index({ ip: 1, createdAt: -1 });
schema.index({ anomalyScoredAt: 1, createdAt: -1 });

import { IOrder } from '../interfaces/models/order.interface';

const Order = mongoose.model<IOrder>('Order', schema, "orders");

export default Order;
