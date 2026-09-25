import { Model, PipelineStage } from "mongoose";

const ATLAS_SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || "default";

type Params<T> = {
  model: Model<T>;
  keyword: string;
  atlasPaths: string | string[];
  limit?: number;
};

const removeAccents = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
};

export const searchAtlas = async <T>({
  model,
  keyword,
  atlasPaths,
  limit = 20
}: Params<T>): Promise<string[]> => {
  if (!keyword || !keyword.trim()) {
    return [];
  }

  const stages: PipelineStage[] = [
    {
      $search: {
        index: ATLAS_SEARCH_INDEX,
        text: {
          query: keyword,
          path: atlasPaths,
          fuzzy: {
            maxEdits: 1
          }
        }
      }
    },
    {
      $limit: limit
    },
    {
      $project: {
        _id: 1
      }
    }
  ];

  // $search against a missing or still-building index returns no hits instead of throwing, so an
  // empty result falls back to the regex search too, not only an error.
  try {
    const results = await model.aggregate(stages);
    const ids = toIds(results);
    if (ids.length > 0) return ids;
  } catch (error) {
    console.error("Atlas search failed, using regex fallback:", error instanceof Error ? error.message : error);
  }

  try {
    const results = await model.find(buildFallbackQuery(model, keyword, atlasPaths)).select("_id").limit(limit);
    return toIds(results);
  } catch (fallbackError) {
    console.error("Fallback search failed:", fallbackError);
    return [];
  }
};

const toIds = (results: Array<{ _id?: unknown }>): string[] =>
  results
    .map((item) => item._id ? String(item._id) : undefined)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildFallbackQuery = <T>(model: Model<T>, keyword: string, atlasPaths: string | string[]): Record<string, unknown> => {
  if (model.schema.path("search")) {
    const words = removeAccents(keyword.trim()).split(/\s+/).filter(Boolean);
    return { $and: words.map(word => ({ search: new RegExp(escapeRegex(word), "i") })) };
  }
  const paths = Array.isArray(atlasPaths) ? atlasPaths : [atlasPaths];
  const regex = new RegExp(escapeRegex(keyword), "i");
  return { $or: paths.map(path => ({ [path]: regex })) };
};

export const findIdsByKeyword = searchAtlas;
