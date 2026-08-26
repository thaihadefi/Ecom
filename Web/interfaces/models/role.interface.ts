import { Document } from "mongoose";

export interface IRole extends Document {
  id?: string;
  name?: string;
  description?: string;
  permissions: string[];
  status?: "active" | "inactive";
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  status?: "active" | "inactive";
  search?: string;
}
