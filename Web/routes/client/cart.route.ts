import { Router } from "express";
import * as cartController from "../../controllers/client/cart.controller";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get('/', cartController.cart);

export default router;

export const cartApi = Router();

cartApi.post('/quote', pageRateLimit({ windowMs: MINUTE, max: 60 }), cartController.list);
