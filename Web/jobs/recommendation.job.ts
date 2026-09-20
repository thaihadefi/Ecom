import cron from "node-cron";
import { recomputeProductRecommendations } from "../services/admin/recommendation.service";

export const autoRecomputeRecommendations = () => {
  cron.schedule("15 3 * * *", async () => {
    try {
      const result = await recomputeProductRecommendations();
      console.log(`[recommendation.job] Recomputed CF recommendations for ${result.productsUpdated} products from ${result.ordersScanned} orders.`);
    } catch (error) {
      console.error("[recommendation.job] Failed to recompute recommendations:", error);
    }
  });
};
