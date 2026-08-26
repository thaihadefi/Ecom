import Coupon from '../../models/coupon.model';
import Order from '../../models/order.model';
import { ICoupon } from '../../interfaces/models/coupon.interface';

export interface CheckCouponResult {
  valid: boolean;
  message?: string;
  couponDetail?: ICoupon | null;
}

export const checkCouponValidity = async (
  code: string,
  userId?: string
): Promise<CheckCouponResult> => {
  const couponDetail = await Coupon.findOne({
    code: code.trim(),
    deleted: false,
    status: "active"
  });

  if (!couponDetail) {
    return { valid: false, message: "Coupon does not exist!" };
  }

  if (userId) {
    const usedCouponCount = await Order.countDocuments({
      userId: userId,
      coupon: couponDetail.code,
      orderStatus: { $nin: ["cancelled", "returned"] },
      deleted: false
    });
    if (usedCouponCount > 0) {
      return { valid: false, message: "You have already used this coupon code!" };
    }
  }

  const now = new Date();
  if (couponDetail.startDate && now < couponDetail.startDate) {
    return { valid: false, message: "Coupon has not started yet!" };
  }

  if (couponDetail.endDate && now > couponDetail.endDate) {
    return { valid: false, message: "Coupon has expired!" };
  }

  if (
    couponDetail.usageLimit &&
    couponDetail.usedCount >= couponDetail.usageLimit
  ) {
    return { valid: false, message: "Coupon has reached its limit!" };
  }

  return {
    valid: true,
    message: "Coupon applied successfully!",
    couponDetail
  };
};
