import { Document } from "mongoose";

export interface IContactInquiry extends Document {
  id?: string;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  read: boolean;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactInquiryInput {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}
