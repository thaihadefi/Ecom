import cron from "node-cron";
import mongoose from "mongoose";
import Order from "../models/order.model";
import { releaseOrderResources, notifyOrderStatusChange } from "../helpers/order.helper";

export const autoCancelUnpaidOrders = () => {
  cron.schedule("*/15 * * * *", async () => {
    const threshold = new Date(Date.now() - 30 * 60 * 1000);

    const staleOrders = await Order.find({
      paymentStatus: "unpaid",
      paymentMethod: { $in: ["zalopay", "vnpay"] },
      orderStatus: "pending",
      deleted: false,
      createdAt: { $lt: threshold }
    }).select("_id code items userId usedPoint coupon");

    if (staleOrders.length === 0) return;

    const cancelPromises = staleOrders.map(async (order) => {
      try {
        const session = await mongoose.startSession();
        let cancelled = false;
        try {
          await session.withTransaction(async () => {
            const result = await Order.updateOne(
              { _id: order._id, orderStatus: "pending" },
              { orderStatus: "cancelled" },
              { session }
            );

            if (result.modifiedCount === 0) return;
            cancelled = true;

            await releaseOrderResources(order, session);
          });
        } finally {
          session.endSession();
        }

        if (cancelled) {
          notifyOrderStatusChange(order, "cancelled");
        }
      } catch (error) {
        console.error(`Error cancelling stale order ${order._id}:`, error);
      }
    });

    await Promise.all(cancelPromises);
  });
};
