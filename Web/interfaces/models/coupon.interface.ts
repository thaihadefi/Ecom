import { Document } from "mongoose";

export interface ICoupon extends Document {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  typeDiscount?: "percentage" | "fixed";
  value?: number;
  minOrderValue?: number;
  maxDiscountValue?: number;
  usageLimit?: number;
  usedCount: number;
  startDate?: Date;
  endDate?: Date;
  typeDisplay?: "public" | "private";
  status?: "active" | "inactive";
  startDateFormat?: string;
  endDateFormat?: string;
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICouponInput {
  code?: string;
  name?: string;
  description?: string;
  typeDiscount?: "percentage" | "fixed";
  value?: number | string;
  minOrderValue?: number | string;
  maxDiscountValue?: number | string;
  usageLimit?: number | string;
  startDate?: Date | string;
  endDate?: Date | string;
  typeDisplay?: "public" | "private";
  status?: "active" | "inactive";
  search?: string;
}
