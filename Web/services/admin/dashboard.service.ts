import Order from '../../models/order.model';
import AccountUser from '../../models/account-user.model';

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

export const getDashboardSummary = async () => {
  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  const baseMatch = {
    paymentStatus: "paid",
    deleted: false,
    orderStatus: { $nin: ["cancelled", "returned"] }
  };

  const baseMatchOrder = { deleted: false };
  const ORDER_STATUSES = ["pending", "confirmed", "shipping", "completed", "cancelled", "returned"];

  const revenueAgg = (match: object) =>
    Order.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$total" } } }]);

  const [
    totalRevenueResult,
    todayRevenueResult,
    yesterdayRevenueResult,
    thisMonthRevenueResult,
    lastMonthRevenueResult,
    totalOrders,
    todayOrders,
    yesterdayOrders,
    thisMonthOrders,
    lastMonthOrders,
    ...statusResults
  ] = await Promise.all([
    revenueAgg(baseMatch),
    revenueAgg({ ...baseMatch, createdAt: { $gte: startToday, $lte: endToday } }),
    revenueAgg({ ...baseMatch, createdAt: { $gte: startYesterday, $lte: endYesterday } }),
    revenueAgg({ ...baseMatch, createdAt: { $gte: startThisMonth, $lte: endThisMonth } }),
    revenueAgg({ ...baseMatch, createdAt: { $gte: startLastMonth, $lte: endLastMonth } }),
    Order.countDocuments(baseMatchOrder),
    Order.countDocuments({ ...baseMatchOrder, createdAt: { $gte: startToday, $lte: endToday } }),
    Order.countDocuments({ ...baseMatchOrder, createdAt: { $gte: startYesterday, $lte: endYesterday } }),
    Order.countDocuments({ ...baseMatchOrder, createdAt: { $gte: startThisMonth, $lte: endThisMonth } }),
    Order.countDocuments({ ...baseMatchOrder, createdAt: { $gte: startLastMonth, $lte: endLastMonth } }),
    ...ORDER_STATUSES.flatMap(status => [
      Order.countDocuments({ ...baseMatchOrder, orderStatus: status }),
      Order.countDocuments({ ...baseMatchOrder, orderStatus: status, createdAt: { $gte: startToday, $lte: endToday } }),
      Order.countDocuments({ ...baseMatchOrder, orderStatus: status, createdAt: { $gte: startYesterday, $lte: endYesterday } }),
      Order.countDocuments({ ...baseMatchOrder, orderStatus: status, createdAt: { $gte: startThisMonth, $lte: endThisMonth } }),
      Order.countDocuments({ ...baseMatchOrder, orderStatus: status, createdAt: { $gte: startLastMonth, $lte: endLastMonth } }),
    ])
  ]);

  const totalRevenue = totalRevenueResult[0]?.total || 0;
  const todayRevenue = todayRevenueResult[0]?.total || 0;
  const yesterdayRevenue = yesterdayRevenueResult[0]?.total || 0;
  const thisMonthRevenue = thisMonthRevenueResult[0]?.total || 0;
  const lastMonthRevenue = lastMonthRevenueResult[0]?.total || 0;

  const todayPercent = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const monthPercent = lastMonthRevenue === 0 ? 100 : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const todayOrderPercent = yesterdayOrders === 0 ? 100 : ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
  const monthOrderPercent = lastMonthOrders === 0 ? 100 : ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100;

  const orderStatusStats: Record<string, { total: number; today: number; todayPercent: number; thisMonth: number; monthPercent: number }> = {};
  ORDER_STATUSES.forEach((status, i) => {
    const base = i * 5;
    const total = statusResults[base];
    const today = statusResults[base + 1];
    const yesterday = statusResults[base + 2];
    const thisMonth = statusResults[base + 3];
    const lastMonth = statusResults[base + 4];
    orderStatusStats[status] = {
      total,
      today,
      todayPercent: yesterday === 0 ? 100 : ((today - yesterday) / yesterday) * 100,
      thisMonth,
      monthPercent: lastMonth === 0 ? 100 : ((thisMonth - lastMonth) / lastMonth) * 100,
    };
  });

  return {
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

export const getRevenueByTimeOverview = async () => {
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

  return {
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

export const getOrderStatisticsOverview = async () => {
  const { startToday, endToday, startThisMonth, endThisMonth } = buildDateRanges();
  const vnTime = getVnNow();
  const y = vnTime.getUTCFullYear();
  const startThisYear = tzDate(y, 0, 1, 0, 0, 0, 0);
  const endThisYear = tzDate(y, 11, 31, 23, 59, 59, 999);

  const [orderStatusToday, orderStatusThisMonth, orderStatusThisYear] = await Promise.all([
    Order.aggregate([
      { $match: { deleted: false, createdAt: { $gte: startToday, $lte: endToday } } },
      { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { deleted: false, createdAt: { $gte: startThisMonth, $lte: endThisMonth } } },
      { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: { deleted: false, createdAt: { $gte: startThisYear, $lte: endThisYear } } },
      { $group: { _id: "$orderStatus", total: { $sum: 1 } } }
    ])
  ]);

  return {
    pieToday: buildPie(orderStatusToday),
    pieThisMonth: buildPie(orderStatusThisMonth),
    pieThisYear: buildPie(orderStatusThisYear)
  };
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

export const getTopSellingProducts = async () => {
  return Order.aggregate([
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
};

export const getCustomerStatistics = async () => {
  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  const [totalUsers, todayUsers, yesterdayUsers, thisMonthUsers, lastMonthUsers, topUsers] = await Promise.all([
    AccountUser.countDocuments({ deleted: false }),
    AccountUser.countDocuments({ deleted: false, createdAt: { $gte: startToday, $lte: endToday } }),
    AccountUser.countDocuments({ deleted: false, createdAt: { $gte: startYesterday, $lte: endYesterday } }),
    AccountUser.countDocuments({ deleted: false, createdAt: { $gte: startThisMonth, $lte: endThisMonth } }),
    AccountUser.countDocuments({ deleted: false, createdAt: { $gte: startLastMonth, $lte: endLastMonth } }),
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
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          fullName: "$user.fullName",
          phone: "$user.phone",
          totalOrders: 1,
          totalSpent: 1
        }
      }
    ])
  ]);

  const todayPercent = yesterdayUsers === 0 ? 100 : ((todayUsers - yesterdayUsers) / yesterdayUsers) * 100;
  const monthPercent = lastMonthUsers === 0 ? 100 : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

  return {
    totalUsers,
    todayUsers,
    todayPercent,
    thisMonthUsers,
    monthPercent,
    topUsers
  };
};
