import { Document } from "mongoose";

export interface IMedia extends Document {
  id?: string;
  folder?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}
