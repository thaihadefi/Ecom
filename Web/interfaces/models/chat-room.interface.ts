import { Document } from "mongoose";

export interface IChatRating {
  stars?: number;
  comment?: string;
  ratedAt?: Date;
}

export interface IChatRoomUnreadCount {
  user: number;
  admin: number;
}

export interface IChatRoom extends Document {
  id?: string;
  userId?: string;
  adminId?: string;
  unreadCount: IChatRoomUnreadCount;
  status?: "open" | "locked";
  rating: IChatRating[];
  createdAt: Date;
  updatedAt: Date;
}
