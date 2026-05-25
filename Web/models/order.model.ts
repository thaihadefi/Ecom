import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: String,
    code: String, // Order code (e.g. AB000001)
    fullName: String,
    phone: String,
    address: String,
    longitude: Number, // Longitude
    latitude: Number, // Latitude
    note: String,
    items: [
      {
        productId: String,
        quantity: Number,
        price: Number,
        variant: [String], // Array of labels (e.g. ["Size: Size M", "Color: Black"])
        image: String,
        name: String
      }
    ],
    subTotal: Number, // Subtotal
    coupon: String, // Coupon code
    discount: Number, // Discount amount
    total: Number, // Final payment total
    paymentMethod: { // Payment method
      type: String,
      enum: [
        "money", // Cash
        "vnpay", // VNPay
        "zalopay" // ZaloPay
      ],
      default: "money"
    },
    paymentStatus: { // Payment status
      type: String,
      enum: [
        "unpaid", // Unpaid
        "paid", // Paid
        "refunded" // Refunded
      ],
      default: "unpaid"
    },
    orderStatus: { // Order status
      type: String,
      enum: [
        "pending",      // Pending
        "confirmed",    // Confirmed
        "shipping",     // Shipping
        "completed",    // Completed
        "cancelled",    // Cancelled
        "returned",     // Returned
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
      default: 0 // Used points count for this order
    },
    pointDiscount: {
      type: Number,
      default: 0 // Discount amount from points
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedBy: String,
    deletedAt: Date
  },
  {
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

// Indexes
schema.index({ userId: 1 });
schema.index({ code: 1 }, { unique: true });
schema.index({ paymentStatus: 1 });
schema.index({ orderStatus: 1 });
schema.index({ deleted: 1 });
schema.index({ createdAt: -1 });
// Compound indexes
schema.index({ paymentStatus: 1, orderStatus: 1, deleted: 1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ deleted: 1, createdAt: -1 });

const Order = mongoose.model('Order', schema, "orders");

export default Order;