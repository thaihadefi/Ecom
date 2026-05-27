import { Request, Response } from "express";
import Coupon from "../../models/coupon.model";
import Order from "../../models/order.model";

export const checkPost = async (req: Request, res: Response) => {
  try {
    const { coupon } = req.body;

    // Find the coupon code
    const couponDetail = await Coupon.findOne({
      code: coupon.trim(),
      deleted: false,
      status: "active"
    });

    if (!couponDetail) {
      res.json({
        code: "error",
        message: "Coupon does not exist!",
      });
      return;
    }

    // Check if user already used this coupon
    if (res.locals.accountUser) {
      const usedCouponCount = await Order.countDocuments({
        userId: res.locals.accountUser.id,
        coupon: couponDetail.code,
        orderStatus: { $nin: ["cancelled", "returned"] },
        deleted: false
      });
      if (usedCouponCount > 0) {
        res.json({
          code: "error",
          message: "You have already used this coupon code!",
        });
        return;
      }
    }

    // Check validity date
    const now = new Date();
    if (couponDetail.startDate && now < couponDetail.startDate) {
      res.json({
        code: "error",
        message: "Coupon has not started yet!",
      });
      return;
    }

    if (couponDetail.endDate && now > couponDetail.endDate) {
      res.json({
        code: "error",
        message: "Coupon has expired!",
      });
      return;
    }

    // Check usage limits
    if (
      couponDetail.usageLimit &&
      couponDetail.usedCount >= couponDetail.usageLimit
    ) {
      res.json({
        code: "error",
        message: "Coupon has reached its limit!",
      });
      return;
    }

    res.json({
      code: "success",
      message: "Coupon applied successfully!",
      couponDetail: couponDetail
    })
  } catch (error) {
    console.error(error);
    res.json({
      code: "error",
      message: "Invalid coupon!"
    })
  }
}