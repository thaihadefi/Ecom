import mongoose from "mongoose";
import { ISetting } from "../interfaces/models/setting.interface";

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
    timestamps: true
  }
);

schema.index({ key: 1 }, { unique: true });

const Setting = mongoose.model<ISetting>('Setting', schema, "settings");

export default Setting;
