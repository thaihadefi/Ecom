import { Model, PipelineStage } from "mongoose";
import { metadataCache } from "./metadata-cache.helper";
import { buildKeywordFilter } from "./list-query.helper";

const ATLAS_SEARCH_INDEX = process.env.ATLAS_SEARCH_INDEX || "default";

type Params<T> = {
  model: Model<T>;
  keyword: string;
  atlasPaths: string | string[];
  limit?: number;
};

const MAX_QUERY_WORDS = 10;

// Typo budget grows with word length, like Elasticsearch's fuzziness AUTO. The first letter must match:
// otherwise a one-letter query is one edit away from every one-letter word and matches everything.
const fuzzyFor = (word: string) => {
  if (word.length <= 2) return undefined;
  return { maxEdits: word.length <= 5 ? 1 : 2, prefixLength: 1 };
};

// Every word must match somewhere; a word in the title (paths[0]) outranks one in the other fields, an exact
// title phrase ranks highest, and the last word also matches as a prefix so results follow the user's typing.
// The title must be mapped as autocomplete (configs/search-index.config.ts), or Atlas rejects the query and
// the regex fallback answers instead.
const buildSearchOperator = (keyword: string, paths: string[]) => {
  const titlePath = paths[0];
  const words = keyword.trim().split(/\s+/).slice(0, MAX_QUERY_WORDS);

  return {
    compound: {
      must: words.map((word, index) => {
        const fuzzy = fuzzyFor(word);
        return {
          compound: {
            should: [
              { text: { query: word, path: titlePath, score: { boost: { value: 3 } } } },
              { text: { query: word, path: paths, ...(fuzzy ? { fuzzy } : {}) } },
              ...(index === words.length - 1 ? [{ autocomplete: { query: word, path: titlePath } }] : [])
            ],
            minimumShouldMatch: 1
          }
        };
      }),
      should: [{ phrase: { query: keyword, path: titlePath, score: { boost: { value: 5 } } } }]
    }
  };
};

// Product and article edits clear every "search:" key, so a cached ranking never outlives the data it ranks.
const SEARCH_IDS_TTL_SECONDS = 60;

export const searchAtlas = async <T>({
  model,
  keyword,
  atlasPaths,
  limit = 20
}: Params<T>): Promise<string[]> => {
  if (!keyword || !keyword.trim()) {
    return [];
  }

  const cacheKey = `search:ids:${model.modelName}:${limit}:${keyword.trim().toLowerCase()}`;
  const cached = metadataCache.get<string[]>(cacheKey);
  if (cached) return cached;

  const ids = await rankIds(model, keyword.trim(), atlasPaths, limit);
  metadataCache.set(cacheKey, ids, SEARCH_IDS_TTL_SECONDS);
  return ids;
};

const rankIds = async <T>(model: Model<T>, keyword: string, atlasPaths: string | string[], limit: number): Promise<string[]> => {
  const stages: PipelineStage[] = [
    {
      $search: {
        index: ATLAS_SEARCH_INDEX,
        ...buildSearchOperator(keyword, Array.isArray(atlasPaths) ? atlasPaths : [atlasPaths])
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

// Every word must appear (accent-insensitive); the folded `search` field is preferred when the model has one.
const buildFallbackQuery = <T>(model: Model<T>, keyword: string, atlasPaths: string | string[]): Record<string, unknown> =>
  buildKeywordFilter(keyword, model.schema.path("search") ? ["search"] : (Array.isArray(atlasPaths) ? atlasPaths : [atlasPaths]));

export const findIdsByKeyword = searchAtlas;
