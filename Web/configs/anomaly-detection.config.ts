export const ANOMALY_DETECTION_CONFIG = {
  TRAINING_LOOKBACK_DAYS: 60,
  MIN_ORDERS_TO_TRAIN: 10,
  NUM_TREES: 200,
  SAMPLE_SIZE: 256,
  // Liu, Ting & Zhou (2008): scores well above 0.5 indicate anomalies. Calibrated via scripts/calibrate-anomaly-detection.ts.
  ANOMALY_THRESHOLD: 0.60,
  // Excludes pending/cancelled/returned so already-caught bot orders don't poison the "normal" baseline.
  TRAINING_ORDER_STATUSES: ["confirmed", "shipping", "completed"],
  RECENT_WINDOW_MINUTES: 15,
  RULE_VELOCITY_ORDER_COUNT: 2,
  RULE_VELOCITY_DISCOUNT_RATIO: 0.3,
  RULE_COUPON_STAMPEDE_COUNT: 5,
  BACKFILL_LOOKBACK_DAYS: 14,
  BACKFILL_BATCH_SIZE: 20,
  // In-distribution "safely old" default for guests (no account to measure age from), not an extreme sentinel Isolation Forest could isolate on its own.
  GUEST_ACCOUNT_AGE_MINUTES: 60 * 24 * 90,
} as const;
