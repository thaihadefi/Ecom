import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String, // Block name
    fileName: String, // UI template file name
    data: Object, // UI template data
    status: {
      type: String,
      enum: ["active", "inactive"], 
      default: "inactive"
    },
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
schema.index({ status: 1, deleted: 1 });

schema.index({ search: 1 });

const Block = mongoose.model('Block', schema, "blocks");

export default Block;