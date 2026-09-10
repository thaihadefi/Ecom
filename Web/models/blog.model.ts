import mongoose from "mongoose";
import SeoSchema from "./schemas/seo.schema";

const schema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    category: [String],
    avatar: String,
    description: String,
    content: String,
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft"
    },
    view: {
      type: Number,
      default: 0
    },
    search: String,
    publishAt: Date,
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    createdBy: String,
    updatedBy: String,
    seo: SeoSchema,
  },
  {
    timestamps: true,
  }
);

schema.index({ slug: 1 }, { unique: true });
schema.index({ deleted: 1 });
schema.index({ status: 1 });
schema.index({ search: 1 });
schema.index({ createdAt: -1 }, { partialFilterExpression: { deleted: false, status: "published" } });
schema.index({ category: 1 }, { partialFilterExpression: { deleted: false, status: "published" } });
schema.index({ deletedAt: -1 }, { partialFilterExpression: { deleted: true } });

import { IBlog } from '../interfaces/models/blog.interface';

const Blog = mongoose.model<IBlog>('Blog', schema, "blogs");

export default Blog;
