import Order from '../../../models/order.model';
import { metadataCache } from '../../../helpers/metadata-cache.helper';
import { percentChange } from './dashboard-shared';
import { buildDateRanges } from './dashboard-time';

export interface DashboardSummaryResult {
  totalRevenue: number;
  todayRevenue: number;
  todayPercent: number;
  thisMonthRevenue: number;
  monthPercent: number;
  totalOrders: number;
  todayOrders: number;
  todayOrderPercent: number;
  thisMonthOrders: number;
  monthOrderPercent: number;
  orderStatusStats: Record<string, {
    total: number;
    today: number;
    todayPercent: number;
    thisMonth: number;
    monthPercent: number;
  }>;
}

export const getDashboardSummary = async (): Promise<DashboardSummaryResult> => {
  const cacheKey = "admin:dashboard:summary";
  const cached = metadataCache.get<DashboardSummaryResult>(cacheKey);
  if (cached) return cached;

  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  const ORDER_STATUSES = ["pending", "confirmed", "shipping", "completed", "cancelled", "returned"];

  const [stats] = (await Order.aggregate([
    { $match: { deleted: false } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        todayOrders: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", startToday] }, { $lte: ["$createdAt", endToday] }] }, 1, 0] }
        },
        yesterdayOrders: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", startYesterday] }, { $lte: ["$createdAt", endYesterday] }] }, 1, 0] }
        },
        thisMonthOrders: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", startThisMonth] }, { $lte: ["$createdAt", endThisMonth] }] }, 1, 0] }
        },
        lastMonthOrders: {
          $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", startLastMonth] }, { $lte: ["$createdAt", endLastMonth] }] }, 1, 0] }
        },
        totalRevenue: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$paymentStatus", "paid"] }, { $not: [{ $in: ["$orderStatus", ["cancelled", "returned"]] }] }] },
              "$total",
              0
            ]
          }
        },
        todayRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "paid"] },
                  { $not: [{ $in: ["$orderStatus", ["cancelled", "returned"]] }] },
                  { $gte: ["$createdAt", startToday] },
                  { $lte: ["$createdAt", endToday] }
                ]
              },
              "$total",
              0
            ]
          }
        },
        yesterdayRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "paid"] },
                  { $not: [{ $in: ["$orderStatus", ["cancelled", "returned"]] }] },
                  { $gte: ["$createdAt", startYesterday] },
                  { $lte: ["$createdAt", endYesterday] }
                ]
              },
              "$total",
              0
            ]
          }
        },
        thisMonthRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "paid"] },
                  { $not: [{ $in: ["$orderStatus", ["cancelled", "returned"]] }] },
                  { $gte: ["$createdAt", startThisMonth] },
                  { $lte: ["$createdAt", endThisMonth] }
                ]
              },
              "$total",
              0
            ]
          }
        },
        lastMonthRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "paid"] },
                  { $not: [{ $in: ["$orderStatus", ["cancelled", "returned"]] }] },
                  { $gte: ["$createdAt", startLastMonth] },
                  { $lte: ["$createdAt", endLastMonth] }
                ]
              },
              "$total",
              0
            ]
          }
        },
        ...ORDER_STATUSES.reduce((acc, status) => {
          acc[`${status}_total`] = { $sum: { $cond: [{ $eq: ["$orderStatus", status] }, 1, 0] } };
          acc[`${status}_today`] = {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$orderStatus", status] }, { $gte: ["$createdAt", startToday] }, { $lte: ["$createdAt", endToday] }] },
                1,
                0
              ]
            }
          };
          acc[`${status}_yesterday`] = {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$orderStatus", status] }, { $gte: ["$createdAt", startYesterday] }, { $lte: ["$createdAt", endYesterday] }] },
                1,
                0
              ]
            }
          };
          acc[`${status}_thisMonth`] = {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$orderStatus", status] }, { $gte: ["$createdAt", startThisMonth] }, { $lte: ["$createdAt", endThisMonth] }] },
                1,
                0
              ]
            }
          };
          acc[`${status}_lastMonth`] = {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$orderStatus", status] }, { $gte: ["$createdAt", startLastMonth] }, { $lte: ["$createdAt", endLastMonth] }] },
                1,
                0
              ]
            }
          };
          return acc;
        }, {} as Record<string, unknown>)
      }
    }
  ])) || {};

  const totalRevenue = stats?.totalRevenue || 0;
  const todayRevenue = stats?.todayRevenue || 0;
  const yesterdayRevenue = stats?.yesterdayRevenue || 0;
  const thisMonthRevenue = stats?.thisMonthRevenue || 0;
  const lastMonthRevenue = stats?.lastMonthRevenue || 0;
  const totalOrders = stats?.totalOrders || 0;
  const todayOrders = stats?.todayOrders || 0;
  const yesterdayOrders = stats?.yesterdayOrders || 0;
  const thisMonthOrders = stats?.thisMonthOrders || 0;
  const lastMonthOrders = stats?.lastMonthOrders || 0;

  const todayPercent = percentChange(todayRevenue, yesterdayRevenue);
  const monthPercent = percentChange(thisMonthRevenue, lastMonthRevenue);
  const todayOrderPercent = percentChange(todayOrders, yesterdayOrders);
  const monthOrderPercent = percentChange(thisMonthOrders, lastMonthOrders);

  const orderStatusStats: Record<string, { total: number; today: number; todayPercent: number; thisMonth: number; monthPercent: number }> = {};
  ORDER_STATUSES.forEach((status) => {
    const total = stats?.[`${status}_total`] || 0;
    const today = stats?.[`${status}_today`] || 0;
    const yesterday = stats?.[`${status}_yesterday`] || 0;
    const thisMonth = stats?.[`${status}_thisMonth`] || 0;
    const lastMonth = stats?.[`${status}_lastMonth`] || 0;
    orderStatusStats[status] = {
      total,
      today,
      todayPercent: percentChange(today, yesterday),
      thisMonth,
      monthPercent: percentChange(thisMonth, lastMonth),
    };
  });

  const result = {
    totalRevenue,
    todayRevenue,
    todayPercent,
    thisMonthRevenue,
    monthPercent,
    totalOrders,
    todayOrders,
    todayOrderPercent,
    thisMonthOrders,
    monthOrderPercent,
    orderStatusStats
  };

  metadataCache.set(cacheKey, result, 60);

  return result;
};
