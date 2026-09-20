import { ClientSession } from 'mongoose';
import Coupon from '../../models/coupon.model';
import Order from '../../models/order.model';
import { ICoupon } from '../../interfaces/models/coupon.interface';

export type CouponRejectReason = "not_found" | "already_used" | "not_started" | "expired" | "limit_reached";

export interface CheckCouponResult {
  valid: boolean;
  message?: string;
  reason?: CouponRejectReason;
  couponDetail?: ICoupon | null;
}

export const couponRejectStatus = (reason?: CouponRejectReason): number => (!reason || reason === "not_found" ? 400 : 409);

export const checkCouponValidity = async (
  code: string,
  userId?: string,
  session?: ClientSession
): Promise<CheckCouponResult> => {
  const couponDetail = await Coupon.findOne({
    code: code.trim(),
    deleted: false,
    status: "active"
  }).session(session ?? null);

  if (!couponDetail) {
    return { valid: false, reason: "not_found", message: "Coupon does not exist!" };
  }

  if (userId) {
    const usedCouponCount = await Order.countDocuments({
      userId: userId,
      coupon: couponDetail.code,
      orderStatus: { $nin: ["cancelled", "returned"] },
      deleted: false
    }).session(session ?? null);
    if (usedCouponCount > 0) {
      return { valid: false, reason: "already_used", message: "You have already used this coupon code!" };
    }
  }

  const now = new Date();
  if (couponDetail.startDate && now < couponDetail.startDate) {
    return { valid: false, reason: "not_started", message: "Coupon has not started yet!" };
  }

  if (couponDetail.endDate && now > couponDetail.endDate) {
    return { valid: false, reason: "expired", message: "Coupon has expired!" };
  }

  if (
    couponDetail.usageLimit &&
    couponDetail.usedCount >= couponDetail.usageLimit
  ) {
    return { valid: false, reason: "limit_reached", message: "Coupon has reached its limit!" };
  }

  return {
    valid: true,
    message: "Coupon applied successfully!",
    couponDetail
  };
};
