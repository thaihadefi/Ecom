// Suggests anomaly thresholds from score/feature distributions vs. ground truth.
// CAVEAT: ground truth is scripts/seed-demo-data.ts's synthetic bot labeling, not real customers -
// re-run against real labeled fraud data once it exists.
// Usage: yarn calibrate:anomaly

import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../configs/database.config";
import Order from "../models/order.model";
import AccountUser from "../models/account-user.model";
import { IsolationForest } from "../helpers/isolation-forest.helper";
import {
  identityOf,
  discountRatioOf,
  buildFeatureVector,
  toVector,
  computeRecentOrderCounts,
  computeCouponVelocity,
  computeDistinctAccountsPerPhone,
  computeDistinctAccountsPerIp
} from "../helpers/order-anomaly-features.helper";
import { ANOMALY_DETECTION_CONFIG } from "../configs/anomaly-detection.config";
import { percentile } from "../helpers/statistics.helper";

const run = async () => {
  dotenv.config();
  await connectDB();

  const since = new Date(Date.now() - ANOMALY_DETECTION_CONFIG.TRAINING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    deleted: false,
    orderStatus: { $in: ANOMALY_DETECTION_CONFIG.TRAINING_ORDER_STATUSES },
    createdAt: { $gte: since }
  })
    .select("userId phone ip coupon discount subTotal createdAt fullName")
    .sort({ createdAt: 1 });

  if (orders.length < ANOMALY_DETECTION_CONFIG.MIN_ORDERS_TO_TRAIN) {
    console.error(`Only ${orders.length} orders in the training window - not enough to calibrate.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean).map(String))];
  const accounts = await AccountUser.find({ _id: { $in: userIds } }).select("_id createdAt");
  const accountCreatedAtMap = new Map(accounts.map((a) => [String(a._id), a.createdAt]));

  const recentOrderCounts = computeRecentOrderCounts(
    orders.map((o) => ({ identity: identityOf(o), createdAt: o.createdAt }))
  );
  const couponVelocities = computeCouponVelocity(
    orders.map((o) => ({ coupon: o.coupon, createdAt: o.createdAt }))
  );
  const phoneAccountReuses = computeDistinctAccountsPerPhone(
    orders.map((o) => ({ phone: o.phone, userId: o.userId }))
  );
  const ipAccountReuses = computeDistinctAccountsPerIp(orders.map((o) => ({ ip: o.ip, userId: o.userId })));

  const rows = orders.map((o, index) => {
    const discountRatio = discountRatioOf(o);
    const fv = buildFeatureVector(
      {
        identity: identityOf(o),
        createdAt: o.createdAt,
        discountRatio,
        isGuest: !o.userId,
        accountCreatedAt: o.userId ? accountCreatedAtMap.get(String(o.userId)) : undefined
      },
      {
        recentOrderCount: recentOrderCounts[index],
        couponVelocity: couponVelocities[index],
        phoneAccountReuse: phoneAccountReuses[index],
        ipAccountReuse: ipAccountReuses[index]
      }
    );
    return {
      isKnownBot: /^Seed Bot/.test(o.fullName || ""),
      discountRatio,
      recentOrderCount: recentOrderCounts[index],
      couponVelocity: couponVelocities[index],
      vec: toVector(fv)
    };
  });

  const forest = new IsolationForest(ANOMALY_DETECTION_CONFIG.NUM_TREES, ANOMALY_DETECTION_CONFIG.SAMPLE_SIZE);
  forest.fit(rows.map((r) => r.vec));
  const scored = rows.map((r) => ({ ...r, score: forest.score(r.vec) }));

  const bots = scored.filter((r) => r.isKnownBot);
  const normals = scored.filter((r) => !r.isKnownBot);
  console.log(`Known bots: ${bots.length}, known normal: ${normals.length}\n`);

  // ML threshold sweep
  console.log("--- ANOMALY_THRESHOLD sweep (ML score only, rules excluded) ---");
  console.log("threshold | precision | recall | F1 | false-positive rate on normal");
  let bestF1 = -1;
  let bestThreshold = ANOMALY_DETECTION_CONFIG.ANOMALY_THRESHOLD;
  for (let t = 0.5; t <= 0.85; t += 0.02) {
    const tp = bots.filter((r) => r.score >= t).length;
    const fn = bots.length - tp;
    const fp = normals.filter((r) => r.score >= t).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = bots.length > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const fpRate = normals.length > 0 ? fp / normals.length : 0;
    console.log(
      `${t.toFixed(2)}     | ${precision.toFixed(2)}      | ${recall.toFixed(2)}   | ${f1.toFixed(2)} | ${(fpRate * 100).toFixed(1)}%`
    );
    if (f1 > bestF1) {
      bestF1 = f1;
      bestThreshold = Math.round(t * 100) / 100;
    }
  }
  console.log(`\nSuggested ANOMALY_THRESHOLD (best F1 on this data): ${bestThreshold} (current: ${ANOMALY_DETECTION_CONFIG.ANOMALY_THRESHOLD})`);

  // Hard rule feature percentiles, split by known label. Sort once per key/population, reuse for every lookup.
  const sortOnce = (values: number[]) => [...values].sort((a, b) => a - b);
  const normalRecentOrderCount = sortOnce(normals.map((r) => r.recentOrderCount));
  const botRecentOrderCount = sortOnce(bots.map((r) => r.recentOrderCount));
  const normalDiscountRatio = sortOnce(normals.map((r) => r.discountRatio));
  const botDiscountRatio = sortOnce(bots.map((r) => r.discountRatio));
  const normalCouponVelocity = sortOnce(normals.map((r) => r.couponVelocity));
  const botCouponVelocity = sortOnce(bots.map((r) => r.couponVelocity));

  console.log("\n--- recentOrderCount: normal vs bot ---");
  console.log(`normal p50/p95/p99: ${percentile(normalRecentOrderCount, 50)}/${percentile(normalRecentOrderCount, 95)}/${percentile(normalRecentOrderCount, 99)}`);
  console.log(`bot    p50/p05:     ${percentile(botRecentOrderCount, 50)}/${percentile(botRecentOrderCount, 5)}`);
  console.log(`Suggested RULE_VELOCITY_ORDER_COUNT: just above normal's p99 (current: ${ANOMALY_DETECTION_CONFIG.RULE_VELOCITY_ORDER_COUNT})`);

  console.log("\n--- discountRatio: normal vs bot ---");
  console.log(`normal p50/p95/p99: ${percentile(normalDiscountRatio, 50).toFixed(2)}/${percentile(normalDiscountRatio, 95).toFixed(2)}/${percentile(normalDiscountRatio, 99).toFixed(2)}`);
  console.log(`bot    p50/p05:     ${percentile(botDiscountRatio, 50).toFixed(2)}/${percentile(botDiscountRatio, 5).toFixed(2)}`);
  console.log(`Suggested RULE_VELOCITY_DISCOUNT_RATIO: just above normal's p95-p99 (current: ${ANOMALY_DETECTION_CONFIG.RULE_VELOCITY_DISCOUNT_RATIO})`);

  console.log("\n--- couponVelocity: normal vs bot ---");
  console.log(`normal p50/p95/p99: ${percentile(normalCouponVelocity, 50)}/${percentile(normalCouponVelocity, 95)}/${percentile(normalCouponVelocity, 99)}`);
  console.log(`bot    p50/p05:     ${percentile(botCouponVelocity, 50)}/${percentile(botCouponVelocity, 5)}`);
  console.log(`Suggested RULE_COUPON_STAMPEDE_COUNT: just above normal's p99 (current: ${ANOMALY_DETECTION_CONFIG.RULE_COUPON_STAMPEDE_COUNT})`);

  console.log("\nReminder: this is calibrated against the synthetic seed-data bot generator, not real customers.");
  console.log("Re-run against real labeled data (confirmed fraud / dismissed-as-safe) once it exists.");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Calibration script failed:", error);
  process.exit(1);
});
