import { autoDeleteChatRoom } from "./chat.job";
import { autoCancelUnpaidOrders } from "./order.job";

export const startJobs = () => {
  autoDeleteChatRoom();
  autoCancelUnpaidOrders();
}