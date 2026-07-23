import cron from "node-cron";
import mongoose from "mongoose";
import Order from "../models/order.model";
import Product from "../models/product.model";
import Coupon from "../models/coupon.model";
import AccountUser from "../models/account-user.model";
import { sendMail, emailTemplates } from "../helpers/mail.helper";

export const autoCancelUnpaidOrders = () => {
  // Run every 15 minutes — cancel ZaloPay/VNPay orders unpaid for over 30 minutes
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
            // Atomically claim — prevents double processing if job overlaps
            const result = await Order.updateOne(
              { _id: order._id, orderStatus: "pending" },
              { orderStatus: "cancelled" },
              { session }
            );

            if (result.modifiedCount === 0) return; // Already processed
            cancelled = true;

            const tasks: Promise<any>[] = [];

            if (order.items?.length > 0) {
              tasks.push(
                Product.bulkWrite(
                  (order.items as any[]).map((item: any) => ({
                    updateOne: {
                      filter: { _id: item.productId },
                      update: { $inc: { stock: item.quantity } }
                    }
                  })),
                  { session }
                )
              );
            }

            if ((order as any).usedPoint > 0) {
              tasks.push(
                AccountUser.updateOne(
                  { _id: (order as any).userId },
                  { $inc: { usedPoint: -(order as any).usedPoint } },
                  { session }
                )
              );
            }

            if ((order as any).coupon) {
              tasks.push(
                Coupon.updateOne(
                  { code: (order as any).coupon, usedCount: { $gt: 0 } },
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

        // Send cancellation email (non-blocking, outside transaction)
        if (cancelled && (order as any).userId) {
          AccountUser.findOne({ _id: (order as any).userId }).select("email fullName").then(user => {
            if (!(user as any)?.email) return;
            return emailTemplates.orderStatusUpdate(
              { code: (order as any).code, fullName: (user as any).fullName || "" },
              "cancelled"
            ).then(tpl => sendMail((user as any).email, tpl.subject, tpl.html));
          }).catch(console.error);
        }
      } catch (error) {
        console.error(`Error cancelling stale order ${order._id}:`, error);
      }
    });

    await Promise.all(cancelPromises);
  });
};
