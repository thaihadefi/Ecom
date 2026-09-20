import { Router } from "express";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import { sessionApi, customerApi, passwordResetApi, passwordApi } from "./auth.route";
import { meApi, reviewApi } from "./dashboard.route";
import { sessionStateApi, chatApi } from "./chat.route";
import { cartApi } from "./cart.route";
import { compareApi } from "./compare.route";
import { wishlistApi } from "./wishlist.route";
import { couponCheckApi } from "./coupon.route";
import { orderApi } from "./order.route";
import { contactInquiryApi } from "./page.route";
import { productApi, productCategoryApi, productSuggestionApi, reviewReportApi } from "./product.route";
import { articleApi, articleCategoryApi } from "./article.route";

const router = Router();

router.use(authMiddleware.verifyToken);

router.use('/sessions', sessionApi);
router.use('/sessions', sessionStateApi);
router.use('/password-resets', passwordResetApi);

router.use('/customers', customerApi);
router.use('/customers/me/password', authMiddleware.loggedIn, passwordApi);
router.use('/customers/me', authMiddleware.loggedIn, meApi);

router.use('/cart', cartApi);
router.use('/compare', compareApi);
router.use('/wishlist', wishlistApi);
router.use('/coupon-checks', couponCheckApi);
router.use('/orders', orderApi);
router.use('/contact-inquiries', contactInquiryApi);
router.use('/chat-rooms', chatApi);

router.use('/reviews/:id/reports', reviewReportApi);
router.use('/reviews', authMiddleware.loggedIn, reviewApi);

router.use('/product-suggestions', productSuggestionApi);
router.use('/products', productApi);
router.use('/product-categories', productCategoryApi);
router.use('/articles', articleApi);
router.use('/article-categories', articleCategoryApi);

router.use((_req, res) => {
  res.status(404).json({ code: "error", message: "Not found!" });
});

export default router;
