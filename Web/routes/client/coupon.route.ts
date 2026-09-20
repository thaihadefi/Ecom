import { Router } from "express";
import * as couponController from "../../controllers/client/coupon.controller";
import * as couponValidate from "../../validates/client/coupon.validate";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

const router = Router();


export default router;

export const couponCheckApi = Router();

couponCheckApi.post('/', pageRateLimit({ windowMs: MINUTE, max: 30 }), couponValidate.checkPost, couponController.checkPost);
