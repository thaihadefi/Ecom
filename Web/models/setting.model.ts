import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: String,
    data: {
      type: Object,
      default: {}
    },
    updatedBy: String,
  },
  {
    timestamps: true // Automatically create createdAt and updatedAt fields
  }
);

schema.index({ key: 1 }, { unique: true });

const Setting = mongoose.model('Setting', schema, "settings");

export default Setting;