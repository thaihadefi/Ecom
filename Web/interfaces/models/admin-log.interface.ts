import { Document } from "mongoose";

export interface IAdminLog extends Document {
  id?: string;
  adminId?: string;
  method?: string;
  route?: string;
  title?: string;
  adminName?: string;
  adminEmail?: string;
  expireAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
