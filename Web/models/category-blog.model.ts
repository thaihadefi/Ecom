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
    timestamps: true, // Automatically generate createdAt and updatedAt fields
  }
);

// Indexes
schema.index({ slug: 1 }, { unique: true });
schema.index({ parent: 1 });
schema.index({ deleted: 1 });
schema.index({ status: 1 });
schema.index({ search: 1 });
// Partial indexes
schema.index({ status: 1, parent: 1 }, { partialFilterExpression: { deleted: false } });

const CategoryBlog = mongoose.model('CategoryBlog', schema, "categories-blog");

export default CategoryBlog;