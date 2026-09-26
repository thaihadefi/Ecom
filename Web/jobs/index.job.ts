import { FEATURES } from "../configs/features.config";
import { autoDeleteChatRoom } from "./chat.job";
import { autoCancelUnpaidOrders } from "./order.job";
import { autoRecomputeRecommendations } from "./recommendation.job";
import { autoRetrainAnomalyModel, autoBackfillMissedScoring } from "./anomaly-detection.job";

export const startJobs = () => {
  // Core jobs (always enabled)
  autoCancelUnpaidOrders();

  // Feature-gated jobs
  if (FEATURES.CHAT) autoDeleteChatRoom();
  if (FEATURES.RECOMMENDATIONS) autoRecomputeRecommendations();
  if (FEATURES.ML_FRAUD_DETECTION) {
    autoRetrainAnomalyModel();
    autoBackfillMissedScoring();
  }
}
