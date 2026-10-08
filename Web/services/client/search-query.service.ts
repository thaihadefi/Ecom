import NodeCache from "node-cache";
import SearchQuery from "../../models/search-query.model";
import { metadataCache } from "../../helpers/metadata-cache.helper";

const POPULAR_LIMIT = 6;
const POPULAR_MIN_COUNT = 3;
const POPULAR_WINDOW_DAYS = 30;
const POPULAR_CACHE_KEY = "popular_searches";
const POPULAR_CACHE_SECONDS = 600;
const MAX_TRACKED_LENGTH = 40;
const REPEAT_WINDOW_SECONDS = 30 * 60;

// The same visitor repeating a search (refresh, paging back) counts once per window, so one person cannot push a term up.
const recentCounts = new NodeCache({ stdTTL: REPEAT_WINDOW_SECONDS, checkperiod: 300, maxKeys: 50_000 });

const normalizeKeyword = (keyword: string): string => keyword.trim().replace(/\s+/g, " ").toLowerCase();

export const recordSearch = (rawKeyword: string, resultCount: number, visitorKey: string): void => {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword || keyword.length > MAX_TRACKED_LENGTH) return;

  const repeatKey = `${visitorKey}:${keyword}`;
  if (recentCounts.has(repeatKey)) return;
  try {
    recentCounts.set(repeatKey, true);
  } catch {
    // The repeat guard is full; counting this search is still fine.
  }

  SearchQuery.updateOne(
    { keyword },
    { $inc: { count: 1 }, $set: { resultCount, lastSearchedAt: new Date() } },
    { upsert: true }
  ).catch((error) => console.error("recordSearch error:", error instanceof Error ? error.message : error));
};

// Only terms several visitors searched recently and that actually found products are shown, so typos,
// junk and abusive text never become a public suggestion.
export const getPopularSearches = async (): Promise<string[]> => {
  const cached = metadataCache.get<string[]>(POPULAR_CACHE_KEY);
  if (cached) return cached;

  const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await SearchQuery.find({
    lastSearchedAt: { $gte: since },
    count: { $gte: POPULAR_MIN_COUNT },
    resultCount: { $gt: 0 }
  })
    .sort({ count: -1 })
    .limit(POPULAR_LIMIT)
    .select("keyword");

  const list = rows.map((row) => row.keyword);
  metadataCache.set(POPULAR_CACHE_KEY, list, POPULAR_CACHE_SECONDS);
  return list;
};
