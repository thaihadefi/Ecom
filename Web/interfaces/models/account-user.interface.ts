import { Document } from "mongoose";

export interface IAccountUser extends Document {
  id?: string;
  googleId?: string;
  facebookId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: "active" | "inactive";
  avatar?: string;
  totalPoint: number;
  usedPoint: number;
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRegisterUserInput {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: "active" | "inactive";
  search?: string;
}

export interface IUpdateUserAccountInput {
  fullName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  password?: string;
}
