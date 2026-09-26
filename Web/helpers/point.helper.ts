import { getStorefront } from "../configs/storefront.config";
import { FEATURES } from "../configs/features.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";
import { invalidateUserAuthCache } from "../services/client/auth.service";

// Loyalty points an order earns once paid: one point per "moneyPerPoint" of goods (Settings > Storefront).
export const pointsEarnedFor = (order: { subTotal?: number; discount?: number; pointDiscount?: number }): number => {
  if (!FEATURES.LOYALTY_POINTS) return 0;
  const productValue = Math.max(0, (order.subTotal || 0) - (order.discount || 0) - (order.pointDiscount || 0));
  return Math.floor(productValue / getStorefront().moneyPerPoint);
};

export const addPointAfterPayment = async (orderCode: string) => {
  const order = await Order.findOne({ code: orderCode, deleted: false }).select("userId subTotal discount pointDiscount pointEarned");
  if (!order?.userId || (order.pointEarned && order.pointEarned > 0)) return;

  const pointEarned = pointsEarnedFor(order);
  if (pointEarned > 0) {
    await Promise.all([
      AccountUser.updateOne(
        { _id: order.userId, deleted: false, status: "active" },
        { $inc: { totalPoint: pointEarned } }
      ),
      Order.updateOne(
        { _id: order._id },
        { pointEarned }
      )
    ]);
    invalidateUserAuthCache(order.userId);
  }
};
