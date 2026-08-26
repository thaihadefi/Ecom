import { Router } from "express";
import dashboardRoutes from "./dashboard.route";
import articleRoutes from "./article.route";
import helperRoutes from "./helper.route";
import fileManagerRoutes from "./file-manager.route";
import roleRoutes from "./role.route";
import accountAdminRoutes from "./account-admin.route";
import accountRoutes from "./account.route";
import productRoutes from "./product.route";
import couponRoutes from "./coupon.route";
import accountUserRoutes from "./account-user.route";
import settingRoutes from "./setting.route";
import orderRoutes from "./order.route";
import reviewRoutes from "./review.route";
import blockRoutes from "./block.route";
import templateRoutes from "./template.route";
import chatRoutes from "./chat.route";
import logRoutes from "./log.route";
import contactInquiryRoutes from "./contact-inquiry.route";

import * as authMiddleware from "../../middlewares/admin/auth.middleware";
import { autoAuditLog } from "../../middlewares/admin/log.middleware";
import * as settingMiddleware from "../../middlewares/client/setting.middleware";
import { pathAdmin } from "../../configs/variable.config";

const router = Router();

router.use(settingMiddleware.general);

router.get('/', authMiddleware.verifyToken, (_req, res) => {
	res.redirect(`/${pathAdmin}/dashboard`);
});

router.use('/dashboard', authMiddleware.verifyToken, autoAuditLog, dashboardRoutes);
router.use('/article', authMiddleware.verifyToken, autoAuditLog, articleRoutes);
router.use('/helper', authMiddleware.verifyToken, autoAuditLog, helperRoutes);
router.use('/file-manager', authMiddleware.verifyToken, autoAuditLog, fileManagerRoutes);
router.use('/role', authMiddleware.verifyToken, autoAuditLog, roleRoutes);
router.use('/account-admin', authMiddleware.verifyToken, autoAuditLog, accountAdminRoutes);
router.use('/account', accountRoutes);
router.use('/product', authMiddleware.verifyToken, autoAuditLog, productRoutes);
router.use('/coupon', authMiddleware.verifyToken, autoAuditLog, couponRoutes);
router.use('/account-user', authMiddleware.verifyToken, autoAuditLog, accountUserRoutes);
router.use('/setting', authMiddleware.verifyToken, autoAuditLog, settingRoutes);
router.use('/order', authMiddleware.verifyToken, autoAuditLog, orderRoutes);
router.use('/review', authMiddleware.verifyToken, autoAuditLog, reviewRoutes);
router.use('/block', authMiddleware.verifyToken, autoAuditLog, blockRoutes);
router.use('/template', authMiddleware.verifyToken, autoAuditLog, templateRoutes);
router.use('/chat', authMiddleware.verifyToken, autoAuditLog, chatRoutes);
router.use('/log', authMiddleware.verifyToken, autoAuditLog, logRoutes);
router.use('/contact-inquiry', authMiddleware.verifyToken, autoAuditLog, contactInquiryRoutes);

router.use(authMiddleware.verifyToken, (_req, res) => {
	res.status(404).render("admin/pages/404", { pageTitle: "404 | Admin" });
});

export default router;
