import mongoose from "mongoose";
import { ISearchQuery } from "../interfaces/models/search-query.interface";

// One row per distinct storefront search, counted anonymously; nothing here identifies a shopper.
const schema = new mongoose.Schema(
  {
    keyword: { type: String, required: true },
    count: { type: Number, default: 0 },
    resultCount: { type: Number, default: 0 },
    lastSearchedAt: Date
  },
  {
    timestamps: true,
  }
);

schema.index({ keyword: 1 }, { unique: true });
schema.index({ lastSearchedAt: -1, count: -1 });

const SearchQuery = mongoose.model<ISearchQuery>('SearchQuery', schema, "search-queries");

export default SearchQuery;
