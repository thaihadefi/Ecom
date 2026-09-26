// Feature flags: toggle optional modules per client through environment variables.
// Every flag defaults to true. A disabled feature hides its UI, answers 404 on its routes
// and APIs, and skips its cron jobs and Socket.IO handlers.

const envBool = (key: string, fallback: boolean = true): boolean => {
  const val = process.env[key];
  if (val === undefined || val.trim() === "") return fallback;
  const normalized = val.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
};

const CHAT = envBool("FEATURE_CHAT");

export const FEATURES = {
  /** Live chat between customers and staff (Socket.IO + admin chat pages) */
  CHAT,

  /** Groq AI helpers inside the admin chat; needs chat and GROQ_API_KEY */
  AI_ASSISTANT: CHAT && envBool("FEATURE_AI") && Boolean(process.env.GROQ_API_KEY?.trim()),

  /** Isolation Forest anomaly detection on new orders + flagged-order queue */
  ML_FRAUD_DETECTION: envBool("FEATURE_ML_FRAUD"),

  /** Item-based collaborative filtering product recommendations */
  RECOMMENDATIONS: envBool("FEATURE_RECOMMENDATIONS"),

  /** Holt's linear trend stock forecasting on the admin dashboard */
  STOCK_FORECAST: envBool("FEATURE_STOCK_FORECAST"),

  /** Articles and article categories (storefront blog, admin editor, sitemap, search) */
  BLOG: envBool("FEATURE_BLOG"),

  /** Customer wishlist */
  WISHLIST: envBool("FEATURE_WISHLIST"),

  /** Product comparison */
  COMPARE: envBool("FEATURE_COMPARE"),

  /** Product reviews, ratings and review reports */
  REVIEWS: envBool("FEATURE_REVIEWS"),

  /** Coupon codes at checkout and their admin pages */
  COUPONS: envBool("FEATURE_COUPONS"),

  /** Loyalty points: earned on paid orders, spent at checkout */
  LOYALTY_POINTS: envBool("FEATURE_LOYALTY"),

  /** Google Translate widget on the storefront */
  TRANSLATE: envBool("FEATURE_TRANSLATE"),
} as const;

export type FeatureName = keyof typeof FEATURES;
