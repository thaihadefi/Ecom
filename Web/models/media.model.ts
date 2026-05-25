import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    folder: String,
    filename: String,
    mimetype: String,
    size: Number
  },
  {
    timestamps: true,
  }
);

// Indexes
schema.index({ folder: 1, createdAt: -1 });
schema.index({ mimetype: 1 });
schema.index({ folder: 1, filename: 1 }, { unique: true });

const Media = mongoose.model('Media', schema, "media");

export default Media;
