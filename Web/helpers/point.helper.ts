import { pointConfig } from "../configs/variable.config";
import AccountUser from "../models/account-user.model";
import Order from "../models/order.model";

export const addPointAfterPayment = async (orderCode: string) => {
  const order = await Order.findOne({ code: orderCode, deleted: false }).select("userId subTotal discount");
  if (!order?.userId) return;

  const productValue = (order.subTotal || 0) - (order.discount || 0);
  const pointEarned = Math.floor(Math.max(0, productValue) / pointConfig.MONEY_PER_POINT);
  if (pointEarned > 0) {
    await AccountUser.updateOne(
      { _id: order.userId, deleted: false, status: "active" },
      { $inc: { totalPoint: pointEarned } }
    );
  }
}
