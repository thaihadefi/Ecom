// Calendar arithmetic in an IANA time zone (e.g. "Asia/Ho_Chi_Minh") without extra libraries.
// Dates are stored in UTC; reports and labels follow the store's time zone.

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

const partsFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric"
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
};

export interface ZonedParts {
  year: number;
  /** 0-based like Date#getMonth */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export const zonedParts = (date: Date, timeZone: string): ZonedParts => {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month - 1,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
};

// Milliseconds the zone is ahead of UTC at that instant (DST aware).
export const zoneOffsetMs = (date: Date, timeZone: string): number => {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
};

// The UTC instant of a wall-clock time in the zone. Month is 0-based and may overflow like Date.UTC.
export const zonedTimeToUtc = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date => {
  const wallAsUtc = Date.UTC(year, month, day, hour, minute, second, ms);
  const firstGuess = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone);
  return new Date(wallAsUtc - zoneOffsetMs(new Date(firstGuess), timeZone));
};

// "YYYY-MM-DD" of the instant in the zone.
export const zonedDayKey = (date: Date, timeZone: string): string => {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

// Pattern tokens YYYY YY MM DD HH mm ss, for gateways that need a fixed local timestamp format.
export const formatInZone = (date: Date, timeZone: string, pattern: string): string => {
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return pattern
    .replace("YYYY", String(p.year))
    .replace("YY", String(p.year).slice(-2))
    .replace("MM", pad(p.month + 1))
    .replace("DD", pad(p.day))
    .replace("HH", pad(p.hour))
    .replace("mm", pad(p.minute))
    .replace("ss", pad(p.second));
};

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};
