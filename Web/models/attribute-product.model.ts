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
    timestamps: true,
  }
);

schema.index({ deleted: 1 });
schema.index({ name: 1, deleted: 1 });

schema.index({ search: 1 });

import { IAttributeProduct } from "../interfaces/models/attribute-product.interface";

const AttributeProduct = mongoose.model<IAttributeProduct>('AttributeProduct', schema, "attributes-product");

export default AttributeProduct;
