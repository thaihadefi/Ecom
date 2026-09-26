import { Router } from "express";
import homeRoutes from "./home.route";
import articleRoutes from "./article.route";
import productRoutes from "./product.route";
import cartRoutes from "./cart.route";
import compareRoutes from "./compare.route";
import wishlistRoutes from "./wishlist.route";
import authRoutes from "./auth.route";
import dashboardRoutes from "./dashboard.route";
import couponRoutes from "./coupon.route";
import checkoutRoutes from "./checkout.route";
import orderRoutes from "./order.route";
import searchRoutes from "./search.route";
import pageRoutes from "./page.route";
import apiRoutes from "./api.route";
import * as categoryMiddleware from "../../middlewares/client/category.middleware";
import * as attributeMiddleware from "../../middlewares/client/attribute.middleware";
import * as authMiddleware from "../../middlewares/client/auth.middleware";
import * as seoMiddleware from "../../middlewares/client/seo.middleware";
import * as settingMiddleware from "../../middlewares/client/setting.middleware";
import * as chatMiddleware from "../../middlewares/client/chat.middleware";
import * as priceFilterMiddleware from "../../middlewares/client/price-filter.middleware";
import { requireFeature } from "../../middlewares/feature.middleware";

const router = Router();

router.use('/api', apiRoutes);

router.use(categoryMiddleware.getAllCategory);

router.use(attributeMiddleware.getAttributeProduct);

router.use(authMiddleware.verifyToken);

router.use(seoMiddleware.canonical);

router.use(settingMiddleware.assetVersion);
router.use(settingMiddleware.general);
router.use(settingMiddleware.paymentMethods);

router.use(chatMiddleware.getChatMessageTotal);

router.use('/', homeRoutes);

router.use('/article', requireFeature("BLOG"), articleRoutes);

router.use('/product', priceFilterMiddleware.priceFilterCeiling, productRoutes);

router.use('/cart', cartRoutes);

router.use('/compare', requireFeature("COMPARE"), compareRoutes);

router.use('/wishlist', requireFeature("WISHLIST"), wishlistRoutes);

router.use('/auth', authRoutes);

router.use('/dashboard', authMiddleware.loggedIn, dashboardRoutes);

router.use('/coupon', requireFeature("COUPONS"), couponRoutes);

router.use('/checkout', checkoutRoutes);

router.use('/order', orderRoutes);

router.use('/search', searchRoutes);
router.use('/', pageRoutes);

export default router;
