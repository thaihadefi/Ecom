import { Model, SortOrder } from "mongoose";
import { escapeRegex } from "./generate.helper";
import { PAGINATION } from "../configs/pagination.config";
import { getPagination } from "./pagination.helper";

const MAX_KEYWORD_WORDS = 10;

// Each base letter also matches its Vietnamese accented forms in both cases, so "nguyen" finds "Nguyễn"
// and "Nguyễn" finds a record saved as "nguyen".
const ACCENT_VARIANTS: Record<string, string> = {
  a: "aàáạảãâầấậẩẫăằắặẳẵ",
  e: "eèéẹẻẽêềếệểễ",
  i: "iìíịỉĩ",
  o: "oòóọỏõôồốộổỗơờớợởỡ",
  u: "uùúụủũưừứựửữ",
  y: "yỳýỵỷỹ",
  d: "dđ"
};

const foldAccents = (text: string): string =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

export const accentInsensitiveRegex = (word: string): RegExp =>
  new RegExp(
    [...foldAccents(word)]
      .map((char) => {
        const variants = ACCENT_VARIANTS[char];
        return variants ? `[${variants}${variants.toUpperCase()}]` : escapeRegex(char);
      })
      .join(""),
    "i"
  );

// Every typed word has to appear in at least one of the fields, in any order: "black linen" finds
// "Linen Shirt, Black". Substring matching stays exact on purpose, since staff look up codes and names.
export const buildKeywordFilter = (rawKeyword: unknown, fields: string[]): Record<string, unknown> => {
  const words = `${rawKeyword ?? ""}`.trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, MAX_KEYWORD_WORDS);
  if (words.length === 0) return {};
  return {
    $and: words.map((word) => {
      const regex = accentInsensitiveRegex(word);
      return { $or: fields.map((field) => ({ [field]: regex })) };
    })
  };
};

export const paginatedSearch = async <T>(
  model: Model<T>,
  rawKeyword: unknown,
  rawPage: unknown,
  opts: { select?: string; sort?: Record<string, SortOrder>; fields?: string[] } = {},
) => {
  const find: Record<string, unknown> = { deleted: false, ...buildKeywordFilter(rawKeyword, opts.fields ?? ["search"]) };

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
