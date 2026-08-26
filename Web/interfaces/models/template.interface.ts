import { Document } from "mongoose";

export interface ITemplateBlock {
  blockId?: string;
  position?: number;
  name?: string;
  fileName?: string;
}

export interface ITemplate extends Document {
  id?: string;
  name?: string;
  slug?: string;
  blocks: ITemplateBlock[];
  status?: "active" | "inactive";
  search?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITemplateInput {
  name?: string;
  slug?: string;
  blocks?: string | ITemplateBlock[];
  status?: "active" | "inactive";
  search?: string;
}
