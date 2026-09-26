import { Router } from "express";
import dashboardRoutes, { statisticsApi as statisticsApi } from "./dashboard.route";
import articleRoutes, { api as articleApi, categoryApi as articleCategoryApi } from "./article.route";
import helperRoutes, { slugApi as slugApi } from "./helper.route";
import fileManagerRoutes, { fileApi as fileApi, folderApi as folderApi } from "./file-manager.route";
import roleRoutes, { api as roleApi } from "./role.route";
import accountAdminRoutes, { api as adminAccountApi } from "./account-admin.route";
import accountRoutes, { sessionApi as adminSessionApi } from "./account.route";
import productRoutes, { api as productApi, categoryApi as productCategoryApi, attributeApi as productAttributeApi, recommendationApi as recommendationApi } from "./product.route";
import couponRoutes, { api as couponApi } from "./coupon.route";
import accountUserRoutes, { api as customerAccountApi } from "./account-user.route";
import settingRoutes, { settingApi as settingApi, cacheApi as cacheApi } from "./setting.route";
import orderRoutes, { api as orderApi, flaggedApi as flaggedOrderApi } from "./order.route";
import reviewRoutes, { api as reviewApi } from "./review.route";
import blockRoutes, { api as blockApi } from "./block.route";
import templateRoutes, { api as templateApi } from "./template.route";
import chatRoutes, { chatApi as chatRoomApi } from "./chat.route";
import logRoutes from "./log.route";
import contactInquiryRoutes, { api as contactInquiryApi } from "./contact-inquiry.route";

import * as authMiddleware from "../../middlewares/admin/auth.middleware";
import { autoAuditLog } from "../../middlewares/admin/log.middleware";
import * as settingMiddleware from "../../middlewares/client/setting.middleware";
import { pathAdmin } from "../../configs/variable.config";
import { requireFeature } from "../../middlewares/feature.middleware";

const router = Router();

router.use(settingMiddleware.assetVersion);
router.use(settingMiddleware.general);

router.get('/', authMiddleware.verifyToken, (_req, res) => {
	res.redirect(`/${pathAdmin}/dashboard`);
});

router.use('/dashboard', authMiddleware.verifyToken, autoAuditLog, dashboardRoutes);

router.use('/api/coupons', authMiddleware.verifyToken, requireFeature("COUPONS"), autoAuditLog, couponApi);
router.use('/api/roles', authMiddleware.verifyToken, autoAuditLog, roleApi);
router.use('/api/admin-accounts', authMiddleware.verifyToken, autoAuditLog, adminAccountApi);
router.use('/api/customer-accounts', authMiddleware.verifyToken, autoAuditLog, customerAccountApi);
router.use('/api/orders', authMiddleware.verifyToken, autoAuditLog, orderApi);
router.use('/api/contact-inquiries', authMiddleware.verifyToken, autoAuditLog, contactInquiryApi);
router.use('/api/articles', authMiddleware.verifyToken, requireFeature("BLOG"), autoAuditLog, articleApi);
router.use('/api/article-categories', authMiddleware.verifyToken, requireFeature("BLOG"), autoAuditLog, articleCategoryApi);
router.use('/api/products', authMiddleware.verifyToken, autoAuditLog, productApi);
router.use('/api/product-categories', authMiddleware.verifyToken, autoAuditLog, productCategoryApi);
router.use('/api/product-attributes', authMiddleware.verifyToken, autoAuditLog, productAttributeApi);
router.use('/api/blocks', authMiddleware.verifyToken, autoAuditLog, blockApi);
router.use('/api/templates', authMiddleware.verifyToken, autoAuditLog, templateApi);
router.use('/api/reviews', authMiddleware.verifyToken, requireFeature("REVIEWS"), autoAuditLog, reviewApi);
router.use('/article', authMiddleware.verifyToken, requireFeature("BLOG"), autoAuditLog, articleRoutes);
router.use('/helper', authMiddleware.verifyToken, autoAuditLog, helperRoutes);
router.use('/file-manager', authMiddleware.verifyToken, autoAuditLog, fileManagerRoutes);
router.use('/role', authMiddleware.verifyToken, autoAuditLog, roleRoutes);
router.use('/account-admin', authMiddleware.verifyToken, autoAuditLog, accountAdminRoutes);
router.use('/account', accountRoutes);
router.use('/product', authMiddleware.verifyToken, autoAuditLog, productRoutes);
router.use('/coupon', authMiddleware.verifyToken, requireFeature("COUPONS"), autoAuditLog, couponRoutes);
router.use('/account-user', authMiddleware.verifyToken, autoAuditLog, accountUserRoutes);
router.use('/setting', authMiddleware.verifyToken, autoAuditLog, settingRoutes);
router.use('/order', authMiddleware.verifyToken, autoAuditLog, orderRoutes);
router.use('/review', authMiddleware.verifyToken, requireFeature("REVIEWS"), autoAuditLog, reviewRoutes);
router.use('/block', authMiddleware.verifyToken, autoAuditLog, blockRoutes);
router.use('/template', authMiddleware.verifyToken, autoAuditLog, templateRoutes);
router.use('/chat', authMiddleware.verifyToken, requireFeature("CHAT"), autoAuditLog, chatRoutes);
router.use('/log', authMiddleware.verifyToken, autoAuditLog, logRoutes);
router.use('/contact-inquiry', authMiddleware.verifyToken, autoAuditLog, contactInquiryRoutes);

router.use('/api/sessions', adminSessionApi);
router.use('/api/recommendation-jobs', authMiddleware.verifyToken, requireFeature("RECOMMENDATIONS"), autoAuditLog, recommendationApi);
router.use('/api/flagged-orders', authMiddleware.verifyToken, requireFeature("ML_FRAUD_DETECTION"), autoAuditLog, flaggedOrderApi);
router.use('/api/chat-rooms', authMiddleware.verifyToken, requireFeature("CHAT"), autoAuditLog, chatRoomApi);
router.use('/api/statistics', authMiddleware.verifyToken, autoAuditLog, statisticsApi);
router.use('/api/slugs', authMiddleware.verifyToken, autoAuditLog, slugApi);
router.use('/api/settings', authMiddleware.verifyToken, autoAuditLog, settingApi);
router.use('/api/cache', authMiddleware.verifyToken, autoAuditLog, cacheApi);
router.use('/api/files', authMiddleware.verifyToken, autoAuditLog, fileApi);
router.use('/api/folders', authMiddleware.verifyToken, autoAuditLog, folderApi);

router.use('/api', authMiddleware.verifyToken, (_req, res) => {
	res.status(404).json({ code: "error", message: "Not found!" });
});

router.use(authMiddleware.verifyToken, (_req, res) => {
	res.status(404).render("admin/pages/404", { pageTitle: "404 | Admin" });
});

export default router;
