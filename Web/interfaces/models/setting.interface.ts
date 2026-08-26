import { Document } from "mongoose";

export interface ISetting<T = Record<string, unknown>> extends Document {
  id?: string;
  key?: string;
  data?: T;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
