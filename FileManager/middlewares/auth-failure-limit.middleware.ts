import { Request } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 20;

const failures = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failures) if (entry.resetAt <= now) failures.delete(key);
}, WINDOW_MS).unref();

const keyOf = (req: Request): string => req.ip || "unknown";

// Only requests that already failed authentication are counted and throttled, so a caller holding the
// correct secret is never locked out, even when someone else spoofs its IP address.
export const retryAfterSeconds = (req: Request): number => {
  const entry = failures.get(keyOf(req));
  if (!entry || entry.resetAt <= Date.now() || entry.count < MAX_FAILURES) return 0;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
};

export const recordFailure = (req: Request): void => {
  const key = keyOf(req);
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
};
