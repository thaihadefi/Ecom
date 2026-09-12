export const RECOMMENDATION_CONFIG = {
  TOP_N: 8,
  TRAINING_LOOKBACK_DAYS: 180,
  TRAINING_ORDER_STATUSES: ["confirmed", "shipping", "completed"],
  MIN_CO_OCCURRENCE: 2,
  RECENCY_HALF_LIFE_DAYS: 30,
  // Candidate pool scored before diversity re-ranking trims it down to TOP_N.
  CANDIDATE_POOL_MULTIPLIER: 3,
  MAX_PER_CATEGORY: 2,
} as const;
