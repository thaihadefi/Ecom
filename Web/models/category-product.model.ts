import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    parent: String,
    description: String,
    avatar: String,
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    view: {
      type: Number,
      default: 0
    },
    deleted: {
      type: Boolean,
      default: false
    },
    search: String,
    deletedAt: Date
  },
  {
    timestamps: true,
  }
);

schema.index({ slug: 1 }, { unique: true });
schema.index({ parent: 1 });
schema.index({ deleted: 1 });
schema.index({ status: 1 });
schema.index({ search: 1 });
schema.index({ status: 1, parent: 1 }, { partialFilterExpression: { deleted: false } });

import { ICategoryProduct } from '../interfaces/models/category-product.interface';

const CategoryProduct = mongoose.model<ICategoryProduct>('CategoryProduct', schema, "categories-product");

export default CategoryProduct;
