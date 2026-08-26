import cron from "node-cron";
import mongoose from "mongoose";
import Order from "../models/order.model";
import Product from "../models/product.model";
import Coupon from "../models/coupon.model";
import AccountUser from "../models/account-user.model";
import { sendMail, emailTemplates } from "../helpers/mail.helper";

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

            const tasks: Promise<unknown>[] = [];

            if (order.items && order.items.length > 0) {
              tasks.push(
                Product.bulkWrite(
                  order.items.map((item) => ({
                    updateOne: {
                      filter: { _id: item.productId },
                      update: { $inc: { stock: item.quantity || 0 } }
                    }
                  })),
                  { session }
                )
              );
            }

            if (order.usedPoint && order.usedPoint > 0) {
              tasks.push(
                AccountUser.updateOne(
                  { _id: order.userId },
                  { $inc: { usedPoint: -order.usedPoint } },
                  { session }
                )
              );
            }

            if (order.coupon) {
              tasks.push(
                Coupon.updateOne(
                  { code: order.coupon, usedCount: { $gt: 0 } },
                  { $inc: { usedCount: -1 } },
                  { session }
                )
              );
            }

            await Promise.all(tasks);
          });
        } finally {
          session.endSession();
        }

        if (cancelled && order.userId) {
          AccountUser.findOne({ _id: order.userId }).select("email fullName").then((user) => {
            if (!user?.email) return;
            return emailTemplates.orderStatusUpdate(
              { code: order.code ?? "", fullName: user.fullName ?? "" },
              "cancelled"
            ).then(tpl => sendMail(user.email!, tpl.subject, tpl.html));
          }).catch(console.error);
        }
      } catch (error) {
        console.error(`Error cancelling stale order ${order._id}:`, error);
      }
    });

    await Promise.all(cancelPromises);
  });
};
