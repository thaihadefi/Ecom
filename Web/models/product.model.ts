import mongoose from "mongoose";
import SeoSchema from "./schemas/seo.schema";

const AttributeValueSchema = new mongoose.Schema(
  {
    attrId: String,
    label: String,
    value: String,
  },
  { _id: false }
);

const VariantSchema = new mongoose.Schema(
  {
    status: { type: Boolean, default: true },
    price: Number,
    stock: Number,
    image: String,
    sku: String,
    attributeValue: [AttributeValueSchema],
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    name: String,
    sku: String,
    slug: String,
    position: Number,
    category: [String],
    images: [String],
    priceOld: Number,
    priceNew: Number,
    discount: {
      type: Number,
      default: 0
    },
    stock: Number,
    attributes: [String],
    variants: [VariantSchema],
    description: String,
    content: String,
    status: {
      type: String,
      enum: ["draft", "active", "inactive"],
      default: "draft"
    },
    view: {
      type: Number,
      default: 0
    },
    search: String,
    tags: [String],
    boughtTogether: [String],
    ratingAvg: {
      type: Number,
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    seo: SeoSchema,
  },
  {
    timestamps: true,
  }
);

schema.index({ slug: 1 }, { unique: true });
schema.index({ category: 1 });
schema.index({ deleted: 1 });
schema.index({ search: 1 });
schema.index({ status: 1, category: 1 }, { partialFilterExpression: { deleted: false } });
schema.index({ createdAt: -1 }, { partialFilterExpression: { deleted: false, status: "active" } });
schema.index({ view: -1 }, { partialFilterExpression: { deleted: false, status: "active" } });
schema.index({ position: 1 }, { partialFilterExpression: { deleted: false } });

import { IProduct } from "../interfaces/models/product.interface";

const Product = mongoose.model<IProduct>('Product', schema, "products");

export default Product;
