// Turns raw order facts into the feature vector fed to the Isolation Forest. Targets scalper/bot behavior, not payment fraud.

import { ANOMALY_DETECTION_CONFIG } from "../configs/anomaly-detection.config";

export const identityOf = (order: { userId?: string; phone?: string }): string =>
  order.userId ? String(order.userId) : `guest:${order.phone || "unknown"}`;

export const discountRatioOf = (order: { discount?: number; subTotal?: number }): number =>
  order.subTotal ? (order.discount || 0) / order.subTotal : 0;

export interface OrderFeatureInput {
  identity: string;
  createdAt: Date;
  discountRatio: number;
  isGuest: boolean;
  accountCreatedAt?: Date;
}

export interface OrderVelocityCounts {
  recentOrderCount: number;
  couponVelocity: number;
  phoneAccountReuse: number;
  ipAccountReuse: number;
}

export interface OrderFeatureVector {
  discountRatio: number;
  accountAgeMinutes: number;
  isGuest: number;
  recentOrderCount: number;
  couponVelocity: number;
  phoneAccountReuse: number;
  ipAccountReuse: number;
}

// orderValue/itemQuantity are deliberately excluded: basket size varies too much across genuine customers to be signal.
export const buildFeatureVector = (
  input: OrderFeatureInput,
  counts: OrderVelocityCounts,
  guestAccountAgeMinutes: number = ANOMALY_DETECTION_CONFIG.GUEST_ACCOUNT_AGE_MINUTES
): OrderFeatureVector => {
  const accountAgeMinutes = input.accountCreatedAt
    ? Math.max(0, (input.createdAt.getTime() - input.accountCreatedAt.getTime()) / 60000)
    : guestAccountAgeMinutes;

  return {
    discountRatio: input.discountRatio,
    accountAgeMinutes,
    isGuest: input.isGuest ? 1 : 0,
    recentOrderCount: counts.recentOrderCount,
    couponVelocity: counts.couponVelocity,
    phoneAccountReuse: counts.phoneAccountReuse,
    ipAccountReuse: counts.ipAccountReuse
  };
};

export const toVector = (f: OrderFeatureVector): number[] => [
  f.discountRatio,
  f.accountAgeMinutes,
  f.isGuest,
  f.recentOrderCount,
  f.couponVelocity,
  f.phoneAccountReuse,
  f.ipAccountReuse
];

// Prunes timestamps once they fall outside the window instead of re-filtering full history each time.
const computeSlidingWindowCount = (
  items: { key: string | undefined; createdAt: Date }[],
  windowMinutes: number
): number[] => {
  const seenByKey = new Map<string, number[]>();
  const counts: number[] = new Array(items.length).fill(0);

  items.forEach((item, index) => {
    if (!item.key) return;
    const timestamps = seenByKey.get(item.key) || [];
    const windowStart = item.createdAt.getTime() - windowMinutes * 60000;

    let staleCount = 0;
    while (staleCount < timestamps.length && timestamps[staleCount] < windowStart) {
      staleCount++;
    }
    if (staleCount > 0) timestamps.splice(0, staleCount);

    counts[index] = timestamps.length;
    timestamps.push(item.createdAt.getTime());
    seenByKey.set(item.key, timestamps);
  });

  return counts;
};

export const computeRecentOrderCounts = (
  orders: { identity: string; createdAt: Date }[],
  windowMinutes: number = ANOMALY_DETECTION_CONFIG.RECENT_WINDOW_MINUTES
): number[] =>
  computeSlidingWindowCount(
    orders.map((o) => ({ key: o.identity, createdAt: o.createdAt })),
    windowMinutes
  );

/** Other orders using the same coupon in the preceding window - catches a promo-code stampede regardless of who placed the orders. */
export const computeCouponVelocity = (
  orders: { coupon?: string; createdAt: Date }[],
  windowMinutes: number = ANOMALY_DETECTION_CONFIG.RECENT_WINDOW_MINUTES
): number[] =>
  computeSlidingWindowCount(
    orders.map((o) => ({ key: o.coupon, createdAt: o.createdAt })),
    windowMinutes
  );

// Causal: only counts accounts seen strictly earlier, so training never leaks future info.
const computeDistinctAccountsPerKey = (items: { key?: string; userId?: string }[]): number[] => {
  const accountsByKey = new Map<string, Set<string>>();
  const counts: number[] = new Array(items.length).fill(0);

  items.forEach((item, index) => {
    if (!item.key) return;
    const accounts = accountsByKey.get(item.key) || new Set<string>();
    counts[index] = accounts.size;
    if (item.userId) accounts.add(item.userId);
    accountsByKey.set(item.key, accounts);
  });

  return counts;
};

export const computeDistinctAccountsPerPhone = (orders: { phone?: string; userId?: string }[]): number[] =>
  computeDistinctAccountsPerKey(orders.map((o) => ({ key: o.phone, userId: o.userId })));

export const computeDistinctAccountsPerIp = (orders: { ip?: string; userId?: string }[]): number[] =>
  computeDistinctAccountsPerKey(orders.map((o) => ({ key: o.ip, userId: o.userId })));
