import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    type: {
      type: String,
      enum: ["text", "select", "color"],
      default: "text"
    },
    options: [
      {
        label: String,
        value: String
      }
    ],
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

schema.index({ deleted: 1 });
schema.index({ name: 1, deleted: 1 });

schema.index({ search: 1 });

const AttributeProduct = mongoose.model('AttributeProduct', schema, "attributes-product");

export default AttributeProduct;