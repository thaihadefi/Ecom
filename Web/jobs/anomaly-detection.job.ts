import { scheduleJob } from "./scheduler";
import { trainAnomalyModel, backfillMissedScoring } from "../services/admin/anomaly-detection.service";

export const autoRetrainAnomalyModel = () => {
  scheduleJob("retrain-anomaly-model", "30 3 * * *", async () => {
    try {
      const result = await trainAnomalyModel();
      console.log(`[anomaly-detection.job] Retrained Isolation Forest on ${result.ordersUsed} orders (trained=${result.trained}).`);
    } catch (error) {
      console.error("[anomaly-detection.job] Failed to retrain anomaly model:", error);
    }
  });
};

export const autoBackfillMissedScoring = () => {
  scheduleJob("backfill-anomaly-scoring", "5,20,35,50 * * * *", async () => {
    try {
      const result = await backfillMissedScoring();
      if (result.backfilled > 0) {
        console.log(`[anomaly-detection.job] Backfilled anomaly scoring for ${result.backfilled} orders.`);
      }
    } catch (error) {
      console.error("[anomaly-detection.job] Failed to backfill missed scoring:", error);
    }
  });
};
