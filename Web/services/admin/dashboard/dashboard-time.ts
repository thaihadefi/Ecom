import { getStorefront } from "../../../configs/storefront.config";
import { zonedDayKey, zonedParts, zonedTimeToUtc } from "../../../helpers/timezone.helper";

// Reports count days, months and hours in the store time zone (Settings > Storefront).
export const reportTimezone = (): string => getStorefront().timezone;

export const storeToday = () => zonedParts(new Date(), reportTimezone());

// UTC instant of a wall-clock time in the store zone; month is 0-based and may overflow like Date.UTC.
export const storeDate = (year: number, month: number, date: number, h = 0, min = 0, s = 0, ms = 0): Date =>
  zonedTimeToUtc(reportTimezone(), year, month, date, h, min, s, ms);

export const storeDayOfMonth = (date: Date): number => zonedParts(date, reportTimezone()).day;

export const storeDayKey = (date: Date): string => zonedDayKey(date, reportTimezone());

// Start (or end) of a calendar day given as year, 1-based month, day.
const storeDayBoundary = (y: number, m: number, d: number, endOfDay = false) =>
  storeDate(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);

export const parseCustomRange = (from: string, to: string) => {
  const isoDate = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!isoDate.test(String(from)) || !isoDate.test(String(to))) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if ([fy, fm, fd, ty, tm, td].some(isNaN)) return null;
  const maxYear = new Date().getUTCFullYear() + 1;
  if (fy < 2000 || ty < 2000 || fy > maxYear || ty > maxYear) return null;

  const fromDate = storeDayBoundary(fy, fm, fd);
  const toDate = storeDayBoundary(ty, tm, td, true);
  if (fromDate > toDate) return null;

  const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  const monthSpan = (ty - fy) * 12 + (tm - fm);
  const granularity: 'hour' | 'day' | 'month' = diffDays < 1 ? 'hour' : monthSpan < 3 ? 'day' : 'month';
  return { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td };
};

export const buildDateRanges = () => {
  const { year: y, month: m, day: d } = storeToday();

  return {
    startToday: storeDate(y, m, d),
    endToday: storeDate(y, m, d, 23, 59, 59, 999),
    startYesterday: storeDate(y, m, d - 1),
    endYesterday: storeDate(y, m, d - 1, 23, 59, 59, 999),
    startThisMonth: storeDate(y, m, 1),
    endThisMonth: storeDate(y, m + 1, 0, 23, 59, 59, 999),
    startLastMonth: storeDate(y, m - 1, 1),
    endLastMonth: storeDate(y, m, 0, 23, 59, 59, 999)
  };
};
