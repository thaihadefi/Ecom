import { Router } from "express";
import * as orderController from "../../controllers/client/order.controller";
import * as orderValidate from "../../validates/client/order.validate";
import { pageRateLimit, MINUTE } from "../../middlewares/rate-limit.middleware";
import * as authMiddleware from "../../middlewares/client/auth.middleware";

const router = Router();

router.get('/success', pageRateLimit({ windowMs: MINUTE, max: 30 }), orderController.success);

router.get('/payment-zalopay', pageRateLimit({ windowMs: MINUTE, max: 20 }), orderController.paymentZaloPay);

router.post('/payment-zalopay-result', orderController.paymentZalopayResult);
router.post('/payment-zalopay-callback', orderController.paymentZalopayResult);

router.get('/payment-vnpay', pageRateLimit({ windowMs: MINUTE, max: 20 }), orderController.paymentVNPay);

router.get('/payment-vnpay-ipn', orderController.paymentVNPayIpn);

router.get('/payment-vnpay-result', orderController.paymentVNPayResult);

export default router;

export const orderApi = Router();

orderApi.post('/', authMiddleware.loggedIn, orderValidate.createPost, orderController.createPost);
