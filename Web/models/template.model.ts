import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String, // Template name
    slug: String, // Path applying the template
    blocks: [ // List of template blocks
      {
        blockId: String, // Template block ID
        position: Number, // Template block position
      }
    ],
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

schema.index({ slug: 1 });
schema.index({ deleted: 1 });
schema.index({ status: 1, deleted: 1 });
schema.index({ name: 1 });

schema.index({ search: 1 });

const Template = mongoose.model('Template', schema, "templates");

export default Template;