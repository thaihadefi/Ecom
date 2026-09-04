import { Model, SortOrder } from "mongoose";
import { escapeRegex } from "./generate.helper";
import { toSearchText } from "./slugify.helper";
import { PAGINATION } from "../configs/pagination.config";
import { getPagination } from "./pagination.helper";

/**
 * The admin list endpoints all share the same shape: filter out trashed rows,
 * optionally match the normalised `search` text field, page with ADMIN_LIMIT,
 * and return `{ recordList, pagination }`. Pages that need extra data (parent
 * names, formatted dates) run their own pass over the returned recordList.
 *
 * Endpoints that search several explicit fields with `$or`, or drop the
 * `deleted` filter entirely, keep their own query.
 */
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
