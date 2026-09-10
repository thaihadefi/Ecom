import { Document } from "mongoose";

export interface IChatMessage extends Document {
  id?: string;
  roomId?: string;
  senderId?: string;
  senderRole?: "user" | "admin";
  content?: string;
  files: string[];
  createdAtFormat?: string;
  createdAt: Date;
  updatedAt: Date;
}
