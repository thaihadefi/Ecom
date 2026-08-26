import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    fileName: String,
    data: Object,
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

schema.index({ deleted: 1 });
schema.index({ status: 1, deleted: 1 });

schema.index({ search: 1 });

import { IBlock } from '../interfaces/models/block.interface';

const Block = mongoose.model<IBlock>('Block', schema, "blocks");

export default Block;
