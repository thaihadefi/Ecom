import { Router } from "express";
import * as orderController from "../../controllers/client/order.controller";
import * as orderValidate from "../../validates/client/order.validate";
import { pageRateLimit, MINUTE, HOUR } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.get('/success', pageRateLimit({ windowMs: MINUTE, max: 30 }), orderController.success);

router.post('/payment-zalopay-result', orderController.paymentZalopayResult);
router.post('/payment-zalopay-callback', orderController.paymentZalopayResult);

router.get('/payment-vnpay-ipn', orderController.paymentVNPayIpn);

router.get('/payment-vnpay-result', orderController.paymentVNPayResult);

// Gateway start for any online method: /order/payment-vnpay, /order/payment-zalopay, ...
// Declared after the gateway callbacks so their paths are not read as a method name.
router.get('/payment-:method', pageRateLimit({ windowMs: MINUTE, max: 20 }), orderController.paymentStart);

export default router;

export const orderApi = Router();

// Guests may order too (the success page finds an order by code and phone); orders reserve stock, so they are rate limited.
orderApi.post('/', pageRateLimit({ windowMs: 10 * MINUTE, max: 5 }, { windowMs: HOUR, max: 15 }), orderValidate.createPost, orderController.createPost);
