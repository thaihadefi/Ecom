import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: String,
    email: String,
    subject: String,
    message: String,
    read: { type: Boolean, default: false },
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
schema.index({ read: 1, deleted: 1 });
schema.index({ createdAt: -1 });

const ContactInquiry = mongoose.model('ContactInquiry', schema, "contact-inquiries");

export default ContactInquiry;
