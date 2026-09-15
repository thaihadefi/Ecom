import Order from '../../models/order.model';
import AccountUser from '../../models/account-user.model';
import Product from '../../models/product.model';
import { metadataCache } from '../../helpers/metadata-cache.helper';
import { computeReorderForecast, IReorderForecast } from '../../helpers/forecast.helper';
import { FORECAST_CONFIG } from '../../configs/forecast.config';

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

export interface RevenueByTimeOverviewResult {
  labelsHour: string[];
  todayData: number[];
  yesterdayData: number[];
  labelsDay: string[];
  thisMonthData: number[];
  lastMonthData: number[];
  labelsMonth: string[];
  thisYearData: number[];
  lastYearData: number[];
}

export interface PieChartData {
  labels: string[];
  datasets: Array<{ data: number[]; backgroundColor: string[] }>;
}

export interface OrderStatisticsOverviewResult {
  pieToday: PieChartData;
  pieThisMonth: PieChartData;
  pieThisYear: PieChartData;
}

export interface TopSellingProductItem {
  _id: unknown;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopUserItem {
  userId: unknown;
  fullName?: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
}

export interface CustomerStatisticsResult {
  totalUsers: number;
  todayUsers: number;
  todayPercent: number;
  thisMonthUsers: number;
  monthPercent: number;
  topUsers: TopUserItem[];
}

export interface InventoryForecastItem extends IReorderForecast {
  productId: string;
  name?: string;
  slug?: string;
  currentStock: number;
}

export interface InventoryForecastResult {
  items: InventoryForecastItem[];
  leadTimeDays: number;
  lookbackDays: number;
}

export const invalidateAdminDashboardCaches = () => {
  metadataCache.del([
    "admin:dashboard:summary",
    "admin:dashboard:revenue_time",
    "admin:dashboard:order_stats",
    "admin:dashboard:top_selling",
    "admin:dashboard:customer_stats",
    "admin:dashboard:inventory_forecast"
  ]);
};

const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000;

export const getVnNow = () => {
  const now = new Date();
  return new Date(now.getTime() + TIMEZONE_OFFSET);
};

export const tzDate = (year: number, month: number, date: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(Date.UTC(year, month, date, h, min, s, ms) - TIMEZONE_OFFSET);

export const getVnDate = (date: Date) => {
  const vnTime = new Date(date.getTime() + TIMEZONE_OFFSET);
  return vnTime.getUTCDate();
};

export const toVNDate = (y: number, m: number, d: number, endOfDay = false) =>
  tzDate(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);

export const parseCustomRange = (from: string, to: string) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if ([fy, fm, fd, ty, tm, td].some(isNaN)) return null;

  const fromDate = toVNDate(fy, fm, fd);
  const toDate = toVNDate(ty, tm, td, true);
  if (fromDate > toDate) return null;

  const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  const monthSpan = (ty - fy) * 12 + (tm - fm);
  const granularity: 'hour' | 'day' | 'month' = diffDays < 1 ? 'hour' : monthSpan < 3 ? 'day' : 'month';
  return { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td };
};

export const buildDateRanges = () => {
  const vnTime = getVnNow();
  const y = vnTime.getUTCFullYear();
  const m = vnTime.getUTCMonth();
  const d = vnTime.getUTCDate();

  const startToday = tzDate(y, m, d, 0, 0, 0, 0);
  const endToday = tzDate(y, m, d, 23, 59, 59, 999);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
  const endYesterday = new Date(endToday.getTime() - 24 * 60 * 60 * 1000);
  const startThisMonth = tzDate(y, m, 1, 0, 0, 0, 0);
  const endThisMonth = tzDate(y, m + 1, 0, 23, 59, 59, 999);
  const startLastMonth = tzDate(y, m - 1, 1, 0, 0, 0, 0);
  const endLastMonth = tzDate(y, m, 0, 23, 59, 59, 999);

  return { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth };
};

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

  const todayPercent = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const monthPercent = lastMonthRevenue === 0 ? 100 : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const todayOrderPercent = yesterdayOrders === 0 ? 100 : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
  const monthOrderPercent = lastMonthOrders === 0 ? 100 : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

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
      todayPercent: yesterday === 0 ? 100 : ((today - yesterday) / yesterday) * 100,
      thisMonth,
      monthPercent: lastMonth === 0 ? 100 : ((thisMonth - lastMonth) / lastMonth) * 100,
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

export const buildRevenueRangeData = async (from: string, to: string) => {
  const range = parseCustomRange(from, to);
  if (!range) return null;
  const { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td } = range;

  let groupId: Record<string, unknown>;
  let sortKey: Record<string, 1 | -1>;
  if (granularity === 'hour') {
    groupId = { hour: { $hour: { date: "$createdAt", timezone: "+07:00" } } };
    sortKey = { "_id.hour": 1 };
  } else if (granularity === 'day') {
    groupId = {
      year: { $year: { date: "$createdAt", timezone: "+07:00" } },
      month: { $month: { date: "$createdAt", timezone: "+07:00" } },
      day: { $dayOfMonth: { date: "$createdAt", timezone: "+07:00" } },
    };
    sortKey = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
  } else {
    groupId = {
      year: { $year: { date: "$createdAt", timezone: "+07:00" } },
      month: { $month: { date: "$createdAt", timezone: "+07:00" } },
    };
    sortKey = { "_id.year": 1, "_id.month": 1 };
  }

  const result = await Order.aggregate([
    { $match: { paymentStatus: "paid", deleted: false, orderStatus: { $nin: ["cancelled", "returned"] }, createdAt: { $gte: fromDate, $lte: toDate } } },
    { $group: { _id: groupId, total: { $sum: "$total" } } },
    { $sort: sortKey },
  ]);

  const labels: string[] = [];
  const data: number[] = [];

  if (granularity === 'hour') {
    const hourMap = new Map(result.map((r) => [r._id.hour, r.total]));
    for (let h = 0; h < 24; h++) {
      labels.push(`${h}:00`);
      data.push((hourMap.get(h) as number) || 0);
    }
  } else if (granularity === 'day') {
    const dayMap = new Map(result.map((r) => [`${r._id.year}-${r._id.month}-${r._id.day}`, r.total]));
    const cursor = new Date(fy, fm - 1, fd);
    const end = new Date(ty, tm - 1, td);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      labels.push(`${cursor.getDate()}/${cursor.getMonth() + 1}`);
      data.push((dayMap.get(key) as number) || 0);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const monthMap = new Map(result.map((r) => [`${r._id.year}-${r._id.month}`, r.total]));
    let cy = fy, cm = fm;
    while (cy < ty || (cy === ty && cm <= tm)) {
      labels.push(`T${cm}/${cy}`);
      data.push((monthMap.get(`${cy}-${cm}`) as number) || 0);
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }
  }

  return { granularity, labels, data };
};

export const getRevenueByTimeOverview = async (): Promise<RevenueByTimeOverviewResult> => {
  const cacheKey = "admin:dashboard:revenue_time";
  const cached = metadataCache.get<RevenueByTimeOverviewResult>(cacheKey);
  if (cached) return cached;

  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  const buildRevenueByHour = async (start: Date, end: Date) => {
    const result = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          deleted: false,
          orderStatus: { $nin: ["cancelled", "returned"] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            hour: {
              $hour: {
                date: "$createdAt",
                timezone: "+07:00"
              }
            }
          },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.hour": 1 } }
    ]);

    const data = Array(24).fill(0);
    result.forEach(item => {
      data[item._id.hour] = item.total;
    });

    return data;
  };

  const todayData = await buildRevenueByHour(startToday, endToday);
  const yesterdayData = await buildRevenueByHour(startYesterday, endYesterday);
  const labelsHour = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  const daysInThisMonth = getVnDate(endThisMonth);
  const daysInLastMonth = getVnDate(endLastMonth);

  const buildRevenueByDay = async (start: Date, end: Date, totalDays: number) => {
    const result = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          deleted: false,
          orderStatus: { $nin: ["cancelled", "returned"] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            day: {
              $dayOfMonth: {
                date: "$createdAt",
                timezone: "+07:00"
              }
            }
          },
          total: { $sum: "$total" }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]);

    const data = Array(totalDays).fill(0);
    result.forEach(item => {
      data[item._id.day - 1] = item.total;
    });

    return data;
  };

  const thisMonthData = await buildRevenueByDay(startThisMonth, endThisMonth, daysInThisMonth);
  const lastMonthData = await buildRevenueByDay(startLastMonth, endLastMonth, daysInLastMonth);
  const labelsDay = Array.from({ length: daysInThisMonth }, (_, i) => `Day ${i + 1}`);

  const vnNow = getVnNow();
  const currentYear = vnNow.getUTCFullYear();
  const lastYear = currentYear - 1;
  const startLastYear = tzDate(lastYear, 0, 1, 0, 0, 0, 0);
  const endCurrentYear = tzDate(currentYear, 11, 31, 23, 59, 59, 999);

  const data = await Order.aggregate([
    {
      $match: {
        paymentStatus: "paid",
        deleted: false,
        orderStatus: { $nin: ["cancelled", "returned"] },
        createdAt: { $gte: startLastYear, $lte: endCurrentYear }
      }
    },
    {
      $project: {
        year: { $year: { date: "$createdAt", timezone: "+07:00" } },
        month: { $month: { date: "$createdAt", timezone: "+07:00" } },
        total: 1
      }
    },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        revenue: { $sum: "$total" }
      }
    }
  ]);

  const thisYearData = Array(12).fill(0);
  const lastYearData = Array(12).fill(0);

  data.forEach(item => {
    const monthIndex = item._id.month - 1;
    if (item._id.year === currentYear) thisYearData[monthIndex] = item.revenue;
    if (item._id.year === lastYear) lastYearData[monthIndex] = item.revenue;
  });

  const labelsMonth = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`);

  const result = {
    labelsHour,
    todayData,
    yesterdayData,
    labelsDay,
    thisMonthData,
    lastMonthData,
    labelsMonth,
    thisYearData,
    lastYearData
  };

  metadataCache.set(cacheKey, result, 60);

  return result;
};

export const ORDER_STATUS_CONFIG = [
  { key: "pending", label: "Pending", color: "#ff9f43" },
  { key: "confirmed", label: "Confirmed", color: "#41cbd8" },
  { key: "shipping", label: "Shipping", color: "#7367f0" },
  { key: "completed", label: "Completed", color: "#22c5ad" },
  { key: "cancelled", label: "Cancelled", color: "#ef4d56" },
  { key: "returned", label: "Returned", color: "#fd7e14" },
];

export const buildPie = (rawData: Array<{ _id: string; total: number }>) => {
  const map = new Map(rawData.map((r) => [r._id, r.total]));
  return {
    labels: ORDER_STATUS_CONFIG.map(c => c.label),
    datasets: [{ data: ORDER_STATUS_CONFIG.map(c => map.get(c.key) || 0), backgroundColor: ORDER_STATUS_CONFIG.map(c => c.color) }],
  };
};

export const getOrderStatisticsOverview = async (): Promise<OrderStatisticsOverviewResult> => {
  const cacheKey = "admin:dashboard:order_stats";
  const cached = metadataCache.get<OrderStatisticsOverviewResult>(cacheKey);
  if (cached) return cached;

  const { startToday, endToday, startThisMonth, endThisMonth } = buildDateRanges();
  const vnTime = getVnNow();
  const y = vnTime.getUTCFullYear();
  const startThisYear = tzDate(y, 0, 1, 0, 0, 0, 0);
  const endThisYear = tzDate(y, 11, 31, 23, 59, 59, 999);

  const [facetResult] = await Order.aggregate<{
    today: Array<{ _id: string; total: number }>;
    thisMonth: Array<{ _id: string; total: number }>;
    thisYear: Array<{ _id: string; total: number }>;
  }>([
    { $match: { deleted: false, createdAt: { $gte: startThisYear, $lte: endThisYear } } },
    {
      $facet: {
        today: [
          { $match: { createdAt: { $gte: startToday, $lte: endToday } } },
          { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
        ],
        thisMonth: [
          { $match: { createdAt: { $gte: startThisMonth, $lte: endThisMonth } } },
          { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
        ],
        thisYear: [
          { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
        ]
      }
    }
  ]);

  const orderStatusToday = facetResult?.today || [];
  const orderStatusThisMonth = facetResult?.thisMonth || [];
  const orderStatusThisYear = facetResult?.thisYear || [];

  const result = {
    pieToday: buildPie(orderStatusToday),
    pieThisMonth: buildPie(orderStatusThisMonth),
    pieThisYear: buildPie(orderStatusThisYear)
  };

  metadataCache.set(cacheKey, result, 60);

  return result;
};

export const getCustomOrderStatistic = async (from: string, to: string) => {
  const range = parseCustomRange(from, to);
  if (!range) return null;
  const result = await Order.aggregate([
    { $match: { deleted: false, createdAt: { $gte: range.fromDate, $lte: range.toDate } } },
    { $group: { _id: "$orderStatus", total: { $sum: 1 } } },
  ]);
  return { pieCustom: buildPie(result) };
};

export const getTopSellingProducts = async (): Promise<TopSellingProductItem[]> => {
  const cacheKey = "admin:dashboard:top_selling";
  const cached = metadataCache.get<TopSellingProductItem[]>(cacheKey);
  if (cached) return cached;

  const result = await Order.aggregate([
    { $match: { paymentStatus: "paid", deleted: false } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" },
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 }
  ]);

  metadataCache.set(cacheKey, result, 300);
  return result;
};

export const getCustomerStatistics = async (): Promise<CustomerStatisticsResult> => {
  const cacheKey = "admin:dashboard:customer_stats";
  const cached = metadataCache.get<CustomerStatisticsResult>(cacheKey);
  if (cached) return cached;

  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  const [userStatsAgg, topUsers] = await Promise.all([
    AccountUser.aggregate<{
      totalUsers: number;
      todayUsers: number;
      yesterdayUsers: number;
      thisMonthUsers: number;
      lastMonthUsers: number;
    }>([
      { $match: { deleted: false } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          todayUsers: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startToday] }, { $lte: ["$createdAt", endToday] }] },
                1,
                0
              ]
            }
          },
          yesterdayUsers: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startYesterday] }, { $lte: ["$createdAt", endYesterday] }] },
                1,
                0
              ]
            }
          },
          thisMonthUsers: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startThisMonth] }, { $lte: ["$createdAt", endThisMonth] }] },
                1,
                0
              ]
            }
          },
          lastMonthUsers: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startLastMonth] }, { $lte: ["$createdAt", endLastMonth] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Order.aggregate([
      { $match: { paymentStatus: "paid", deleted: false } },
      { $group: { _id: "$userId", totalOrders: { $sum: 1 }, totalSpent: { $sum: "$total" } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "accounts-user",
          let: { userId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$userId"] } } }],
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          fullName: { $ifNull: ["$user.fullName", "Unknown"] },
          phone: { $ifNull: ["$user.phone", ""] },
          totalOrders: 1,
          totalSpent: 1
        }
      }
    ])
  ]);

  const userStats = userStatsAgg[0] || {
    totalUsers: 0,
    todayUsers: 0,
    yesterdayUsers: 0,
    thisMonthUsers: 0,
    lastMonthUsers: 0
  };
  const { totalUsers, todayUsers, yesterdayUsers, thisMonthUsers, lastMonthUsers } = userStats;

  const todayPercent = yesterdayUsers === 0 ? 100 : ((todayUsers - yesterdayUsers) / yesterdayUsers) * 100;
  const monthPercent = lastMonthUsers === 0 ? 100 : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

  const result = {
    totalUsers,
    todayUsers,
    todayPercent,
    thisMonthUsers,
    monthPercent,
    topUsers
  };

  metadataCache.set(cacheKey, result, 60);
  return result;
};

const FORECAST_LOOKBACK_DAYS = FORECAST_CONFIG.LOOKBACK_DAYS;
const FORECAST_LEAD_TIME_DAYS = FORECAST_CONFIG.LEAD_TIME_DAYS;
const FORECAST_REVIEW_PERIOD_DAYS = FORECAST_CONFIG.REVIEW_PERIOD_DAYS;

const formatVnDayKey = (date: Date): string => {
  const vnTime = new Date(date.getTime() + TIMEZONE_OFFSET);
  const y = vnTime.getUTCFullYear();
  const m = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(vnTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getInventoryForecast = async (): Promise<InventoryForecastResult> => {
  const cacheKey = "admin:dashboard:inventory_forecast";
  const cached = metadataCache.get<InventoryForecastResult>(cacheKey);
  if (cached) return cached;

  const vnNow = getVnNow();
  const endDate = tzDate(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), 23, 59, 59, 999);
  const startDate = new Date(endDate.getTime() - FORECAST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const rows = await Order.aggregate<{ _id: { productId: string; day: string }; quantity: number }>([
    {
      $match: {
        paymentStatus: "paid",
        deleted: false,
        orderStatus: { $nin: ["cancelled", "returned"] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          productId: "$items.productId",
          day: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "+07:00" } }
        },
        quantity: { $sum: "$items.quantity" }
      }
    }
  ]);

  const demandByProduct = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const productId = String(row._id.productId);
    if (!demandByProduct.has(productId)) demandByProduct.set(productId, new Map());
    demandByProduct.get(productId)!.set(row._id.day, row.quantity);
  }

  const dayKeys: string[] = [];
  for (let i = FORECAST_LOOKBACK_DAYS - 1; i >= 0; i--) {
    dayKeys.push(formatVnDayKey(new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)));
  }

  const productIdsWithSales = Array.from(demandByProduct.keys());
  const products = await Product.find({
    deleted: false,
    status: "active",
    $or: [{ _id: { $in: productIdsWithSales } }, { stock: { $lte: 0 } }]
  }).select("_id name slug stock");

  const items = products.map((product) => {
    const dayMap = demandByProduct.get(String(product._id)) || new Map();
    const series = dayKeys.map((day) => dayMap.get(day) || 0);
    const currentStock = product.stock || 0;

    const forecast = computeReorderForecast(
      series,
      currentStock,
      FORECAST_LEAD_TIME_DAYS,
      FORECAST_REVIEW_PERIOD_DAYS
    );

    return {
      productId: String(product._id),
      name: product.name,
      slug: product.slug,
      currentStock,
      ...forecast
    };
  });

  items.sort((a, b) => {
    if (a.needsReorder !== b.needsReorder) return a.needsReorder ? -1 : 1;
    if (a.daysOfSupply === b.daysOfSupply) return 0; // avoids Infinity - Infinity = NaN
    return a.daysOfSupply - b.daysOfSupply;
  });

  const result = {
    items: items.slice(0, 30),
    leadTimeDays: FORECAST_LEAD_TIME_DAYS,
    lookbackDays: FORECAST_LOOKBACK_DAYS
  };

  metadataCache.set(cacheKey, result, 900);
  return result;
};
