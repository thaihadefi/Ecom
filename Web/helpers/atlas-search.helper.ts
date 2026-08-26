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

  try {
    const results = await model.aggregate(stages);
    return results
      .map((item: { _id?: unknown }) => item._id ? String(item._id) : undefined)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch (error) {
    let fallbackQuery: Record<string, unknown>;

    if (model.schema.path("search")) {
      const cleanKeyword = removeAccents(keyword.trim());
      const words = cleanKeyword.split(/\s+/).filter(Boolean);
      fallbackQuery = {
        $and: words.map(word => ({
          search: new RegExp(word, "i")
        }))
      };
    } else {
      const paths = Array.isArray(atlasPaths) ? atlasPaths : [atlasPaths];
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      fallbackQuery = {
        $or: paths.map(path => ({ [path]: regex }))
      };
    }

    try {
      const results = await model.find(fallbackQuery).select("_id").limit(limit);
      return results
        .map((item: { _id?: unknown }) => item._id ? String(item._id) : undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    } catch (fallbackError) {
      console.error("Fallback search failed:", fallbackError);
      return [];
    }
  }
};

export const findIdsByKeyword = searchAtlas;
