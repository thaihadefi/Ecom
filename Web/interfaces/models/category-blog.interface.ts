import { Document } from "mongoose";

export interface ICategoryBlog extends Document {
  id?: string;
  name?: string;
  slug?: string;
  parent?: string;
  parentName?: string;
  description?: string;
  avatar?: string;
  status?: "active" | "inactive";
  view: number;
  deleted: boolean;
  search?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryBlogInput {
  name?: string;
  slug?: string;
  parent?: string;
  description?: string;
  avatar?: string;
  status?: "active" | "inactive";
  search?: string;
}
