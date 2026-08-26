import mongoose from "mongoose";
import { IContactInquiry } from "../interfaces/models/contact-inquiry.interface";

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

const ContactInquiry = mongoose.model<IContactInquiry>('ContactInquiry', schema, "contact-inquiries");

export default ContactInquiry;
