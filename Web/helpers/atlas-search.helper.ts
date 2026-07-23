import { Model } from "mongoose";

const ATLAS_SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || "default";

type Params<T> = {
  model: Model<T>;
  keyword: string;
  atlasPaths: string | string[];
  limit?: number;
};

// Helper function to normalize and remove accents for standard Vietnamese search compatibility
const removeAccents = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
};

export const findIdsByKeyword = async <T>({ model, keyword, atlasPaths, limit = 2000 }: Params<T>): Promise<string[]> => {
  if(!keyword || !/[\p{L}\p{N}]/u.test(keyword)) return [];

  const pipeline: any[] = [
    {
      $search: {
        index: ATLAS_SEARCH_INDEX,
        text: { query: keyword, path: atlasPaths },
      },
    },
    { $project: { _id: 1 } },
    { $limit: limit },
  ];

  try {
    // Try Atlas Search
    const results = await model.aggregate(pipeline);
    return results.map((item: any) => item._id?.toString()).filter(Boolean);
  } catch (error) {
    // Fallback: local/regex search if Atlas Search is unavailable, index is missing, or fails
    const hasSearchField = model.schema.path("search") !== undefined;
    const normalized = removeAccents(keyword);
    const words = normalized
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .split(/\s+/)
      .filter(Boolean);

    let fallbackQuery: any = {};

    if (hasSearchField && words.length > 0) {
      // Powerful multi-word search against the pre-computed 'search' field (slugified/no-accents)
      fallbackQuery = {
        $and: words.map(word => ({
          search: new RegExp(word, "i")
        }))
      };
    } else {
      // Generic fallback search against original paths
      const paths = Array.isArray(atlasPaths) ? atlasPaths : [atlasPaths];
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      fallbackQuery = {
        $or: paths.map(path => ({ [path]: regex }))
      };
    }

    try {
      const results = await (model as any).find(fallbackQuery).select("_id").limit(limit);
      return results.map((item: any) => item._id?.toString()).filter(Boolean);
    } catch (fallbackError) {
      console.error("Fallback search failed:", fallbackError);
      return [];
    }
  }
};
