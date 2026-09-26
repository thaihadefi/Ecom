import { getStorefront } from "../configs/storefront.config";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(2) + " MB";
};

export function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals: Record<string, number> = {
    year: 31536000,
    month: 2592000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (const key in intervals) {
    const value = Math.floor(seconds / intervals[key]);
    if (value >= 1) {
      return `${value} ${key}${value > 1 ? "s" : ""} ago`;
    }
  }
  return "Just now";
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

const cachedDateFormatter = (key: string, locale: string, options: Intl.DateTimeFormatOptions) => {
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatterCache.set(key, formatter);
  }
  return formatter;
};

const toValidDate = (date: Date | string | number | undefined | null): Date | null => {
  if (date === undefined || date === null || date === "") return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Dates follow the store locale and time zone from Settings > Storefront.
export const formatDate = (date: Date | string | number | undefined): string => {
  const d = toValidDate(date);
  if (!d) return "";
  const { locale, timezone } = getStorefront();
  return cachedDateFormatter(`d|${locale}|${timezone}`, locale, {
    timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric"
  }).format(d);
};

export const formatDateTime = (date: Date | string | number | undefined): string => {
  const d = toValidDate(date);
  if (!d) return "";
  const { locale, timezone } = getStorefront();
  const time = cachedDateFormatter(`t|${locale}|${timezone}`, locale, {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(d);
  return `${time} ${formatDate(d)}`;
};

const cachedNumberFormatter = (key: string, locale: string, options: Intl.NumberFormatOptions) => {
  let formatter = numberFormatterCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, options);
    } catch {
      formatter = new Intl.NumberFormat("en-US", options);
    }
    numberFormatterCache.set(key, formatter);
  }
  return formatter;
};

const toNumber = (amount: number | string | undefined | null): number => {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount ?? ""));
  return Number.isFinite(num) ? num : 0;
};

// Money in the store currency, e.g. "1.200.000 ₫" (VND, vi-VN) or "$12.50" (USD, en-US).
export const formatPrice = (amount: number | string | undefined | null): string => {
  const { locale, currency } = getStorefront();
  return cachedNumberFormatter(`c|${locale}|${currency}`, locale, {
    style: "currency", currency, currencyDisplay: "narrowSymbol"
  }).format(toNumber(amount));
};

// Storefront price markup: the client currency switcher converts elements carrying data-base-price.
export const priceHtml = (amount: number | string | undefined | null): string =>
  `<span class="currency-amount" data-base-price="${toNumber(amount)}">${formatPrice(amount)}</span>`;

export const formatNumber = (value: number | string | undefined | null): string => {
  const { locale } = getStorefront();
  return cachedNumberFormatter(`n|${locale}`, locale, { maximumFractionDigits: 2 }).format(toNumber(value));
};

// Vietnamese phone numbers are stored as digits (GoShip needs that); group them for display:
// landlines "(028) 3725 2002", mobiles "0912 345 678". Anything else is shown as stored.
export const formatPhone = (phone: string | undefined): string => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (/^02\d{9}$/.test(digits)) return `(${digits.slice(0, 3)}) ${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (/^0\d{9}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return String(phone ?? "").trim();
};
