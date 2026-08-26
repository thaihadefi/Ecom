import { Request, Response } from "express";
import * as couponService from "../../services/client/coupon.service";

export const checkPost = async (req: Request, res: Response) => {
  try {
    const { coupon } = req.body;
    const userId = res.locals.accountUser?.id;

    const result = await couponService.checkCouponValidity(coupon || "", userId);

    if (!result.valid) {
      res.json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: result.message,
      couponDetail: result.couponDetail
    });
  } catch (error) {
    console.error("coupon check error:", error);
    res.json({
      code: "error",
      message: "Invalid coupon!"
    });
  }
};
