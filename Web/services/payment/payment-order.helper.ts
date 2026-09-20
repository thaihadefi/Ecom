import Order from "../../models/order.model";
import { addPointAfterPayment } from "../../helpers/point.helper";
import { invalidateAdminDashboardCaches } from "../admin/dashboard.service";
import { invalidateUserAuthCache } from "../client/auth.service";
import { invalidateUserDashboardCache } from "../client/dashboard.service";

export type PaymentApplyResult = "paid" | "already-paid" | "not-found" | "amount-mismatch";

export const applyGatewayPayment = async (phone: string, orderCode: string, paidAmount: number): Promise<PaymentApplyResult> => {
  const order = await Order.findOne({ phone, code: orderCode, deleted: false }).select("_id userId total paymentStatus orderStatus");
  if (!order) return "not-found";
  if (order.paymentStatus === "paid") return "already-paid";
  if (!Number.isFinite(paidAmount) || paidAmount !== (order.total || 0)) return "amount-mismatch";

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: "unpaid" },
    { paymentStatus: "paid" }
  );
  if (!claimed) return "already-paid";

  if (order.orderStatus === "cancelled" || order.orderStatus === "returned") {
    console.warn(`[Payment] Order ${orderCode} was ${order.orderStatus} when its payment arrived. Refund required.`);
  } else {
    await addPointAfterPayment(orderCode);
  }

  invalidateAdminDashboardCaches();
  if (order.userId) {
    invalidateUserAuthCache(order.userId);
    invalidateUserDashboardCache(order.userId);
  }
  return "paid";
};
