import { Document } from "mongoose";

export interface ISearchQuery extends Document {
  id?: string;
  keyword: string;
  count: number;
  resultCount: number;
  lastSearchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
