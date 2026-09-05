import { Model, SortOrder } from "mongoose";
import { escapeRegex } from "./generate.helper";
import { toSearchText } from "./slugify.helper";
import { PAGINATION } from "../configs/pagination.config";
import { getPagination } from "./pagination.helper";

export const paginatedSearch = async <T>(
  model: Model<T>,
  rawKeyword: unknown,
  rawPage: unknown,
  opts: { select?: string; sort?: Record<string, SortOrder> } = {},
) => {
  const find: { deleted: boolean; search?: RegExp } = { deleted: false };
  if (rawKeyword) {
    find.search = new RegExp(escapeRegex(toSearchText(`${rawKeyword}`)), "i");
  }

  const limit = PAGINATION.ADMIN_LIMIT;
  const totalRecord = await model.countDocuments(find);
  const pagination = getPagination(rawPage, limit, totalRecord);

  const recordList = await model
    .find(find)
    .select(opts.select ?? "")
    .limit(limit)
    .skip(pagination.skip)
    .sort(opts.sort ?? { createdAt: "desc" });

  return { recordList, pagination };
};
