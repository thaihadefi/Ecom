import Order from "../../models/order.model";
import Product from "../../models/product.model";
import { computeItemBasedCf, applyDiversityCap } from "../../helpers/recommendation.helper";
import { invalidateProductCaches } from "../../helpers/metadata-cache.helper";
import { RECOMMENDATION_CONFIG } from "../../configs/recommendation.config";

export const recomputeProductRecommendations = async () => {
  const since = new Date(Date.now() - RECOMMENDATION_CONFIG.TRAINING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    deleted: false,
    orderStatus: { $in: RECOMMENDATION_CONFIG.TRAINING_ORDER_STATUSES },
    createdAt: { $gte: since }
  }).select("items.productId createdAt");

  const cfOrders = orders.map((order) => ({
    items: (order.items || []).map((item) => String(item.productId)).filter(Boolean),
    createdAt: order.createdAt
  }));

  const candidatePool = computeItemBasedCf(
    cfOrders,
    RECOMMENDATION_CONFIG.TOP_N * RECOMMENDATION_CONFIG.CANDIDATE_POOL_MULTIPLIER
  );

  const allCandidateIds = new Set<string>();
  for (const candidates of candidatePool.values()) {
    for (const c of candidates) allCandidateIds.add(c.productId);
  }
  const candidateProducts = await Product.find({
    _id: { $in: Array.from(allCandidateIds) },
    deleted: false,
    status: "active"
  }).select("category");
  const categoryByProductId = new Map(candidateProducts.map((p) => [String(p._id), (p.category || []).map(String)]));

  const recommendationsByProduct = new Map(
    Array.from(candidatePool.entries()).map(([productId, candidates]) => [
      productId,
      applyDiversityCap(
        candidates
          .filter((c) => categoryByProductId.has(c.productId))
          .map((c) => ({ productId: c.productId, score: c.score, categories: categoryByProductId.get(c.productId) || [] })),
        RECOMMENDATION_CONFIG.TOP_N,
        RECOMMENDATION_CONFIG.MAX_PER_CATEGORY
      )
    ])
  );

  // Clears out recommendations for products that no longer have co-purchase support.
  const staleClearResult = await Product.updateMany(
    {
      cfRecommendations: { $exists: true, $ne: [] },
      _id: { $nin: Array.from(recommendationsByProduct.keys()) }
    },
    { $set: { cfRecommendations: [] } }
  );

  if (recommendationsByProduct.size === 0) {
    if (staleClearResult.modifiedCount > 0) invalidateProductCaches();
    return { productsUpdated: 0, ordersScanned: orders.length };
  }

  const bulkOps = Array.from(recommendationsByProduct.entries()).map(([productId, cfRecommendations]) => ({
    updateOne: {
      filter: { _id: productId },
      update: { $set: { cfRecommendations } }
    }
  }));

  await Product.bulkWrite(bulkOps, { ordered: false });
  invalidateProductCaches();

  return { productsUpdated: bulkOps.length, ordersScanned: orders.length };
};

export interface ManualRecomputeStatus {
  status: "idle" | "running";
  lastRunAt: Date | null;
  lastResult: { productsUpdated: number; ordersScanned: number } | null;
  lastError: string | null;
}

// Same pattern as anomaly-detection.service's manual retrain: route returns
// immediately, UI polls getManualRecomputeStatus() instead of holding the
// connection open (a full order-history scan + Product.bulkWrite can run
// past a browser/proxy HTTP timeout at real order volumes).
let manualRecomputeStatus: ManualRecomputeStatus = {
  status: "idle",
  lastRunAt: null,
  lastResult: null,
  lastError: null
};

export const getManualRecomputeStatus = (): ManualRecomputeStatus => manualRecomputeStatus;

export const triggerManualRecompute = (): ManualRecomputeStatus => {
  if (manualRecomputeStatus.status === "running") return manualRecomputeStatus;

  manualRecomputeStatus = { ...manualRecomputeStatus, status: "running" };

  (async () => {
    try {
      const result = await recomputeProductRecommendations();
      manualRecomputeStatus = {
        status: "idle",
        lastRunAt: new Date(),
        lastResult: result,
        lastError: null
      };
    } catch (error) {
      manualRecomputeStatus = {
        status: "idle",
        lastRunAt: new Date(),
        lastResult: null,
        lastError: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  return manualRecomputeStatus;
};
