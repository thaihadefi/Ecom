export const FORECAST_CONFIG = {
  LOOKBACK_DAYS: 30,
  LEAD_TIME_DAYS: 3,
  REVIEW_PERIOD_DAYS: 7,
  // Holt's linear trend smoothing factors (level, trend).
  LEVEL_SMOOTHING_ALPHA: 0.3,
  TREND_SMOOTHING_BETA: 0.1,
  MIN_SALE_DAYS_FOR_TREND: 5,
  // 95% service level (one-sided z-score).
  SERVICE_LEVEL_Z: 1.65,
  OUTLIER_CAP_PERCENTILE: 95,
} as const;
