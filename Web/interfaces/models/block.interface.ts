import { Document } from "mongoose";

export interface IBlock extends Document {
  id?: string;
  name?: string;
  fileName?: string;
  data?: Record<string, unknown>;
  status?: "active" | "inactive";
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBlockInput {
  name?: string;
  fileName?: string;
  data?: Record<string, unknown> | string;
  status?: "active" | "inactive";
  search?: string;
}
