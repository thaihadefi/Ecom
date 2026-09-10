import { Request, Response } from 'express';
import * as dashboardService from '../../services/admin/dashboard.service';

export const dashboard = async (_req: Request, res: Response) => {
  const data = await dashboardService.getDashboardSummary();

  res.render("admin/pages/dashboard", {
    pageTitle: "Dashboard",
    ...data
  });
};

export const revenueByTimeData = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.json({ code: 'error' });
    return;
  }

  const result = await dashboardService.buildRevenueRangeData(from as string, to as string);
  if (!result) {
    res.json({ code: 'error' });
    return;
  }

  res.json({ code: 'success', from, to, ...result });
};

export const revenueByTime = async (_req: Request, res: Response) => {
  const data = await dashboardService.getRevenueByTimeOverview();

  res.render("admin/pages/dashboard-revenue-by-time.pug", {
    pageTitle: "Revenue Over Time",
    ...data
  });
};

export const orderStatisticData = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.json({ code: 'error' });
    return;
  }

  const result = await dashboardService.getCustomOrderStatistic(from as string, to as string);
  if (!result) {
    res.json({ code: 'error' });
    return;
  }

  res.json({ code: 'success', from, to, ...result });
};

export const orderStatistic = async (_req: Request, res: Response) => {
  const data = await dashboardService.getOrderStatisticsOverview();

  res.render("admin/pages/dashboard-order-statistic.pug", {
    pageTitle: "Order Statistics",
    ...data
  });
};

export const topSellingProducts = async (_req: Request, res: Response) => {
  const topProducts = await dashboardService.getTopSellingProducts();

  res.render("admin/pages/dashboard-top-selling-products.pug", {
    pageTitle: "Top Selling Products",
    topProducts
  });
};

export const customerStatistic = async (_req: Request, res: Response) => {
  const data = await dashboardService.getCustomerStatistics();

  res.render("admin/pages/dashboard-customer-statistic.pug", {
    pageTitle: "Customer Statistics",
    ...data
  });
};
