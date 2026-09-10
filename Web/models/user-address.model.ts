import mongoose from "mongoose";
import { IUserAddress } from "../interfaces/models/user-address.interface";

const schema = new mongoose.Schema({
  userId: String,
  fullName: String,
  phone: String,
  address: String,
  longitude: Number,
  latitude: Number,
  isDefault: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true
});

schema.index({ userId: 1 });
schema.index({ userId: 1, isDefault: 1 });

const UserAddress = mongoose.model<IUserAddress>('UserAddress', schema, "user-address");

export default UserAddress;
