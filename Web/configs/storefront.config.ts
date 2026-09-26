import { getCachedSetting } from "./setting.config";

// Look and locale of the store, edited in Settings > Storefront. Missing fields fall back to these
// defaults, so a fresh database behaves like the original Vietnamese store.
export interface StorefrontSettings {
  primaryColor: string;
  secondaryColor: string;
  /** Google Fonts family names; empty keeps the theme's fonts */
  headingFont: string;
  bodyFont: string;
  /** ISO 4217 code prices are entered, stored and charged in; chosen once when the store is set up */
  currency: string;
  /** Currencies shoppers may view prices in (converted with live rates, for reference only) */
  displayCurrencies: string[];
  /** BCP 47 locale for numbers and dates, e.g. vi-VN, en-US */
  locale: string;
  /** IANA time zone for reports, order dates and "today" */
  timezone: string;
  /** html lang attribute of the storefront */
  language: string;
  /** Order value that earns one loyalty point */
  moneyPerPoint: number;
  /** Discount one loyalty point is worth at checkout */
  pointValue: number;
}

export const STOREFRONT_DEFAULTS: StorefrontSettings = {
  primaryColor: "#0057B7",
  secondaryColor: "#FFD700",
  headingFont: "",
  bodyFont: "",
  currency: "VND",
  displayCurrencies: ["VND", "USD", "EUR", "JPY", "GBP", "CNY"],
  locale: "vi-VN",
  timezone: "Asia/Ho_Chi_Minh",
  language: "en",
  moneyPerPoint: 10000,
  pointValue: 100,
};

let current: StorefrontSettings = { ...STOREFRONT_DEFAULTS };

const pick = <T>(value: T | undefined | null | "", fallback: T): T =>
  value === undefined || value === null || value === "" ? fallback : value;

export const normalizeStorefront = (data: Partial<StorefrontSettings> | undefined): StorefrontSettings => {
  const d = data || {};
  const positive = (value: unknown, fallback: number) => (Number(value) > 0 ? Number(value) : fallback);
  const currency = pick(d.currency, STOREFRONT_DEFAULTS.currency).toUpperCase();
  const display = Array.isArray(d.displayCurrencies) ? d.displayCurrencies : STOREFRONT_DEFAULTS.displayCurrencies;
  return {
    primaryColor: pick(d.primaryColor, STOREFRONT_DEFAULTS.primaryColor),
    secondaryColor: pick(d.secondaryColor, STOREFRONT_DEFAULTS.secondaryColor),
    headingFont: pick(d.headingFont, STOREFRONT_DEFAULTS.headingFont),
    bodyFont: pick(d.bodyFont, STOREFRONT_DEFAULTS.bodyFont),
    currency,
    // The store currency always comes first, so shoppers can switch back to it.
    displayCurrencies: [...new Set([currency, ...display.map((c) => String(c).toUpperCase())])],
    locale: pick(d.locale, STOREFRONT_DEFAULTS.locale),
    timezone: pick(d.timezone, STOREFRONT_DEFAULTS.timezone),
    language: pick(d.language, STOREFRONT_DEFAULTS.language),
    moneyPerPoint: positive(d.moneyPerPoint, STOREFRONT_DEFAULTS.moneyPerPoint),
    pointValue: positive(d.pointValue, STOREFRONT_DEFAULTS.pointValue),
  };
};

// Synchronous read for formatters and templates; refreshed by loadStorefront().
export const getStorefront = (): StorefrontSettings => current;

// Reads the (cached) setting and makes it current. Called per request, at startup and by jobs.
export const loadStorefront = async (): Promise<StorefrontSettings> => {
  current = normalizeStorefront(await getCachedSetting<Partial<StorefrontSettings>>("storefront"));
  return current;
};

// Decimal places of the store currency (VND 0, USD 2, ...).
export const currencyDigits = (currency = current.currency): number => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

// A price entered by staff, rounded to the currency's decimals; invalid or negative input is 0.
export const toMoney = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  const factor = 10 ** currencyDigits();
  return Math.round(parsed * factor) / factor;
};
