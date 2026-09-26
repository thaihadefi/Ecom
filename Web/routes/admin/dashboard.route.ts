import { Router } from "express";
import * as dashboardController from "../../controllers/admin/dashboard.controller";
import { checkPermission } from "../../middlewares/admin/auth.middleware";
import { requireFeature } from "../../middlewares/feature.middleware";

const router = Router();

const db = checkPermission("dashboard");

router.get('/', db, dashboardController.dashboard);

router.get('/revenue-by-time', db, dashboardController.revenueByTime);

router.get('/order-statistic', db, dashboardController.orderStatistic);

router.get('/top-selling-products', db, dashboardController.topSellingProducts);

router.get('/inventory-forecast', db, requireFeature("STOCK_FORECAST"), dashboardController.inventoryForecast);

router.get('/customer-statistic', db, dashboardController.customerStatistic);

export default router;

export const statisticsApi = Router();

statisticsApi.get('/revenue-by-time', db, dashboardController.revenueByTimeData);

statisticsApi.get('/orders', db, dashboardController.orderStatisticData);
