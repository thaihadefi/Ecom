import { Document } from "mongoose";

export interface IAccountAdmin extends Document {
  id?: string;
  fullName?: string;
  email?: string;
  password?: string;
  roles: string[];
  rolesName?: string[];
  status?: "initial" | "active" | "inactive";
  avatar?: string;
  search?: string;
  isSuperAdmin: boolean;
  lastLoginAt?: Date;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountAdminInput {
  fullName?: string;
  email?: string;
  password?: string;
  roles?: string | string[];
  status?: "initial" | "active" | "inactive";
  avatar?: string;
  search?: string;
  isSuperAdmin?: boolean;
}
