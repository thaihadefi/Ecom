import { Request, Response } from "express";
import * as couponService from "../../services/client/coupon.service";
import { sendCaughtError } from "../../helpers/http-response.helper";

export const checkPost = async (req: Request, res: Response) => {
  try {
    const { coupon } = req.body;
    const userId = res.locals.accountUser?.id;

    const result = await couponService.checkCouponValidity(coupon || "", userId);

    if (!result.valid) {
      res.status(couponService.couponRejectStatus(result.reason)).json({
        code: "error",
        message: result.message
      });
      return;
    }

    res.json({
      code: "success",
      message: result.message,
      couponDetail: {
        code: result.couponDetail?.code,
        name: result.couponDetail?.name,
        typeDiscount: result.couponDetail?.typeDiscount,
        value: result.couponDetail?.value,
        minOrderValue: result.couponDetail?.minOrderValue,
        maxDiscountValue: result.couponDetail?.maxDiscountValue
      }
    });
  } catch (error) {
    console.error("coupon check error:", error);
    sendCaughtError(res, error, "Invalid coupon!", "Invalid coupon!");
  }
};
