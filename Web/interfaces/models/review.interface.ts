import { Document } from "mongoose";

export interface IReview extends Document {
  id?: string;
  userId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  variant: string[];
  rating: number;
  comment?: string;
  images: string[];
  status?: "approved" | "rejected" | null;
  reportCount: number;
  reportedBy: string[];
  user?: { fullName?: string; email?: string; avatar?: string };
  product?: { name?: string; images?: string[] };
  createdAt: Date;
  updatedAt: Date;
}
