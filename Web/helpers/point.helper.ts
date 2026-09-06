import { pointConfig } from "../configs/variable.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";

export const addPointAfterPayment = async (orderCode: string) => {
  const order = await Order.findOne({ code: orderCode, deleted: false }).select("userId subTotal discount pointDiscount pointEarned");
  if (!order?.userId || (order.pointEarned && order.pointEarned > 0)) return;

  const productValue = Math.max(0, (order.subTotal || 0) - (order.discount || 0) - (order.pointDiscount || 0));
  const pointEarned = Math.floor(productValue / pointConfig.MONEY_PER_POINT);
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
  }
};
