import { autoDeleteChatRoom } from "./chat.job";
import { autoCancelUnpaidOrders } from "./order.job";
import { autoRecomputeRecommendations } from "./recommendation.job";
import { autoRetrainAnomalyModel, autoBackfillMissedScoring } from "./anomaly-detection.job";

export const startJobs = () => {
  autoDeleteChatRoom();
  autoCancelUnpaidOrders();
  autoRecomputeRecommendations();
  autoRetrainAnomalyModel();
  autoBackfillMissedScoring();
}
