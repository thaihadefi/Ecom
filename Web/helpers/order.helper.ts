import { ClientSession } from "mongoose";
import Product from "../models/product.model";
import Coupon from "../models/coupon.model";
import AccountUser from "../models/account-user.model";
import { sendMail, emailTemplates } from "./mail.helper";
import { IOrder } from "../interfaces/models/order.interface";

/**
 * Roll back everything an order consumed when it moves to a terminal state
 * (cancelled / returned): restore product stock, refund used loyalty points,
 * and give back one coupon use. Runs inside the caller's transaction session.
 *
 * Used by both the admin status-change flow and the auto-cancel cron job, which
 * previously carried byte-identical copies of this block.
 */
export const releaseOrderResources = async (
  order: Pick<IOrder, "items" | "usedPoint" | "coupon" | "userId">,
  session: ClientSession,
): Promise<void> => {
  const tasks: Promise<unknown>[] = [];

  if (order.items && order.items.length > 0) {
    tasks.push(
      Product.bulkWrite(
        order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.productId },
            update: { $inc: { stock: item.quantity || 0 } },
          },
        })),
        { session },
      ),
    );
  }

  if (order.usedPoint && order.usedPoint > 0) {
    tasks.push(
      AccountUser.updateOne(
        { _id: order.userId },
        { $inc: { usedPoint: -order.usedPoint } },
        { session },
      ),
    );
  }

  if (order.coupon) {
    tasks.push(
      Coupon.updateOne(
        { code: order.coupon, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      ),
    );
  }

  await Promise.all(tasks);
};

/**
 * Email the customer that their order status changed. Fire-and-forget: a mail
 * failure must not roll back the status change, but it is logged.
 */
export const notifyOrderStatusChange = (
  order: Pick<IOrder, "userId" | "code">,
  newStatus: string,
): void => {
  if (!order.userId) return;

  AccountUser.findOne({ _id: order.userId })
    .select("email fullName")
    .then((user) => {
      if (!user?.email) return;
      return emailTemplates
        .orderStatusUpdate(
          { code: order.code ?? "", fullName: user.fullName ?? "" },
          newStatus,
        )
        .then((tpl) => sendMail(user.email!, tpl.subject, tpl.html));
    })
    .catch(console.error);
};
