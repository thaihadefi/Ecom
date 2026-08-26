import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    blocks: [
      {
        blockId: String,
        position: Number,
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
    timestamps: true,
  }
);

schema.index({ slug: 1 });
schema.index({ deleted: 1 });
schema.index({ status: 1, deleted: 1 });
schema.index({ name: 1 });

schema.index({ search: 1 });

import { ITemplate } from '../interfaces/models/template.interface';

const Template = mongoose.model<ITemplate>('Template', schema, "templates");

export default Template;
