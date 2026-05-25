import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true
    },
    orderId: {
      type: String,
      required: true
    },
    orderItemId: {
      type: String,
      required: true
    },
    productId: {
      type: String,
      required: true
    },
    variant: [String],
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: String,
    images: [String],
    status: {
      type: String,
      enum: ["approved", "rejected"],
      default: null
    },
    reportCount: {
      type: Number,
      default: 0
    },
    reportedBy: [String]
  },
  {
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

schema.index({ userId: 1, orderItemId: 1 }, { unique: true });
schema.index({ productId: 1 });
schema.index({ createdAt: -1 });
schema.index({ productId: 1, createdAt: -1 });
schema.index({ reportCount: -1 });

const Review = mongoose.model('Review', schema, "reviews");

export default Review;