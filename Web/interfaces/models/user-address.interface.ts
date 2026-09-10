import { Document } from "mongoose";

export interface IUserAddress extends Document {
  id?: string;
  userId?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  type?: string;
  longitude?: number;
  latitude?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserAddressInput {
  userId?: string;
  fullName?: string;
  phone?: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  type?: string;
  longitude?: number | string;
  latitude?: number | string;
  isDefault?: boolean | string;
}
