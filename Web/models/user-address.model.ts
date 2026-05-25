import mongoose from "mongoose";

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
  timestamps: true // Automatically generate createdAt and updatedAt fields
});

schema.index({ userId: 1 });
schema.index({ userId: 1, isDefault: 1 });

const UserAddress = mongoose.model('UserAddress', schema, "user-address");

export default UserAddress;