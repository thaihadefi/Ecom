import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";

const router = Router();

const db = checkPermission("dashboard");

router.get('/', db, dashboardController.dashboard);

router.get('/revenue-by-time', db, dashboardController.revenueByTime);
router.get('/revenue-by-time/data', db, dashboardController.revenueByTimeData);

router.get('/order-statistic', db, dashboardController.orderStatistic);
router.get('/order-statistic/data', db, dashboardController.orderStatisticData);

router.get('/top-selling-products', db, dashboardController.topSellingProducts);

router.get('/customer-statistic', db, dashboardController.customerStatistic);

export default router;