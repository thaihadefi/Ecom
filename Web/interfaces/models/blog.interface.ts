import { Document } from "mongoose";
import { ISeo } from "./seo.interface";

export interface IBlog extends Document {
  id?: string;
  name?: string;
  slug?: string;
  category: string[];
  avatar?: string;
  description?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
  view: number;
  search?: string;
  publishAt?: Date;
  author?: string;
  sourceUrl?: string;
  deleted: boolean;
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  authorName?: string;
  date?: string;
  updatedDate?: string;
  createdAtFormat?: string;
  seo?: ISeo;
  createdAt: Date;
  updatedAt: Date;
}

export interface IArticleInput {
  name?: string;
  slug?: string;
  category?: string | string[];
  avatar?: string;
  description?: string;
  content?: string;
  status?: "draft" | "published" | "archived";
  publishAt?: Date | string;
  author?: string;
  sourceUrl?: string;
  createdBy?: string;
  updatedBy?: string;
  search?: string;
  seo?: ISeo;
}
