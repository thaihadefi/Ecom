import { Request, Response } from 'express';
import Order from '../../models/order.model';
import AccountUser from '../../models/account-user.model';

const TIMEZONE_OFFSET = 7 * 60 * 60 * 1000; // Vietnam UTC+7

const getVnNow = () => {
  const now = new Date();
  return new Date(now.getTime() + TIMEZONE_OFFSET);
};

const tzDate = (year: number, month: number, date: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(Date.UTC(year, month, date, h, min, s, ms) - TIMEZONE_OFFSET);

const getVnDate = (date: Date) => {
  const vnTime = new Date(date.getTime() + TIMEZONE_OFFSET);
  return vnTime.getUTCDate();
};

const toVNDate = (y: number, m: number, d: number, endOfDay = false) =>
  tzDate(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);

const parseCustomRange = (from: string, to: string) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if ([fy, fm, fd, ty, tm, td].some(isNaN)) return null;

  const fromDate = toVNDate(fy, fm, fd);
  const toDate   = toVNDate(ty, tm, td, true);
  if (fromDate > toDate) return null;

  const diffDays   = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  const monthSpan  = (ty - fy) * 12 + (tm - fm);
  const granularity: 'hour' | 'day' | 'month' = diffDays < 1 ? 'hour' : monthSpan < 3 ? 'day' : 'month';
  return { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td };
};

const buildDateRanges = () => {
  const vnTime = getVnNow();
  const y = vnTime.getUTCFullYear();
  const m = vnTime.getUTCMonth();
  const d = vnTime.getUTCDate();

  const startToday     = tzDate(y, m, d, 0, 0, 0, 0);
  const endToday       = tzDate(y, m, d, 23, 59, 59, 999);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);
  const endYesterday   = new Date(endToday.getTime()   - 24 * 60 * 60 * 1000);
  const startThisMonth = tzDate(y, m, 1, 0, 0, 0, 0);
  const endThisMonth   = tzDate(y, m + 1, 0, 23, 59, 59, 999);
  const startLastMonth = tzDate(y, m - 1, 1, 0, 0, 0, 0);
  const endLastMonth   = tzDate(y, m, 0, 23, 59, 59, 999);

  return { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth };
};

export const dashboard = async (req: Request, res: Response) => {
  // REVENUE SECTION
  
  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  // Common conditions
  const baseMatch = {
    paymentStatus: "paid",
    deleted: false,
    orderStatus: { $nin: ["cancelled", "returned"] }
  };

  // All revenue + order queries run in parallel
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

  const orderStatusStats: any = {};
  ORDER_STATUSES.forEach((status, i) => {
    const base = i * 5;
    const total     = statusResults[base];
    const today     = statusResults[base + 1];
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

  res.render("admin/pages/dashboard", {
    pageTitle: "Dashboard",
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
    orderStatusStats,
  });
}

const buildRevenueRangeData = async (from: string, to: string) => {
  const range = parseCustomRange(from, to);
  if (!range) return null;
  const { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td } = range;

  let groupId: any;
  let sortKey: any;
  if (granularity === 'hour') {
    groupId = { hour: { $hour: { date: "$createdAt", timezone: "+07:00" } } };
    sortKey  = { "_id.hour": 1 };
  } else if (granularity === 'day') {
    groupId = {
      year:  { $year:       { date: "$createdAt", timezone: "+07:00" } },
      month: { $month:      { date: "$createdAt", timezone: "+07:00" } },
      day:   { $dayOfMonth: { date: "$createdAt", timezone: "+07:00" } },
    };
    sortKey = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
  } else {
    groupId = {
      year:  { $year:  { date: "$createdAt", timezone: "+07:00" } },
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
  const data: number[]   = [];

  if (granularity === 'hour') {
    const hourMap = new Map(result.map((r: any) => [r._id.hour, r.total]));
    for (let h = 0; h < 24; h++) {
      labels.push(`${h}:00`);
      data.push((hourMap.get(h) as number) || 0);
    }
  } else if (granularity === 'day') {
    const dayMap = new Map(result.map((r: any) => [`${r._id.year}-${r._id.month}-${r._id.day}`, r.total]));
    const cursor = new Date(fy, fm - 1, fd);
    const end    = new Date(ty, tm - 1, td);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      labels.push(`${cursor.getDate()}/${cursor.getMonth() + 1}`);
      data.push((dayMap.get(key) as number) || 0);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const monthMap = new Map(result.map((r: any) => [`${r._id.year}-${r._id.month}`, r.total]));
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

export const revenueByTimeData = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) { res.json({ code: 'error' }); return; }
  const result = await buildRevenueRangeData(from as string, to as string);
  if (!result) { res.json({ code: 'error' }); return; }
  res.json({ code: 'success', from, to, ...result });
};

export const revenueByTime = async (req: Request, res: Response) => {
  // Default — fixed ranges
  // REVENUE BY HOUR CHART
  // Current time milestone
  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  // Function to get revenue data by hour
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
        // Get hour in day (0 → 23)
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
      {
        $sort: { "_id.hour": 1 }
      }
    ]);

    // Normalize data: Ensure a full 24 hours
    const data = Array(24).fill(0);
    result.forEach(item => {
      data[item._id.hour] = item.total;
    });

    return data;
  };

  // Get data for today and yesterday
  const todayData = await buildRevenueByHour(startToday, endToday);
  const yesterdayData = await buildRevenueByHour(startYesterday, endYesterday);
  
  // x-axis label by hour
  const labelsHour = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  // END REVENUE BY HOUR CHART

  // REVENUE BY DAY CHART
  // Number of days in each month
  const daysInThisMonth = getVnDate(endThisMonth);
  const daysInLastMonth = getVnDate(endLastMonth);

  // Function to calculate revenue by day
  const buildRevenueByDay = async (
    start: Date,
    end: Date,
    totalDays: number
  ) => {
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
        // Group by day of month (1 → 31)
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

    // Normalize data: Always return a full number of days in the month
    const data = Array(totalDays).fill(0);
    result.forEach(item => {
      data[item._id.day - 1] = item.total;
    });

    return data;
  };

  // Get data for this month and last month
  const thisMonthData = await buildRevenueByDay(
    startThisMonth,
    endThisMonth,
    daysInThisMonth
  );

  const lastMonthData = await buildRevenueByDay(
    startLastMonth,
    endLastMonth,
    daysInLastMonth
  );

  // x-axis label by day
  const labelsDay = Array.from(
    { length: daysInThisMonth },
    (_, i) => `Day ${i + 1}`
  );
  // END REVENUE BY DAY CHART

  // / REVENUE BY MONTH CHART
  const vnNow = getVnNow();
  const currentYear = vnNow.getUTCFullYear();
  const lastYear = currentYear - 1;

  // Start time of last year
  const startLastYear = tzDate(lastYear, 0, 1, 0, 0, 0, 0);

  // End time of current year
  const endCurrentYear = tzDate(currentYear, 11, 31, 23, 59, 59, 999);

  /**
   * Goal:
   * - Get paid orders
   * - In the range from start of last year -> end of this year
   * - Group by YEAR + MONTH
   * - Calculate total revenue
   */
  const data = await Order.aggregate([
    {
      // Filter valid orders
      $match: {
        paymentStatus: "paid",
        deleted: false,
        orderStatus: { $nin: ["cancelled", "returned"] },
        createdAt: {
          $gte: startLastYear,
          $lte: endCurrentYear
        }
      }
    },
    {
      // Extract year and month from createdAt
      $project: {
        year: {
          $year: {
            date: "$createdAt",
            timezone: "+07:00"
          }
        }, // year of order
        month: {
          $month: {
            date: "$createdAt",
            timezone: "+07:00"
          }
        }, // month of order (1 → 12)
        total: 1 // order value, 1 means keeping that field from original document
      }
    },
    {
      // Group by year + month
      $group: {
        _id: {
          year: "$year",
          month: "$month"
        },
        revenue: {
          $sum: "$total" // total revenue of the month
        }
      }
    }
  ]);

  // Revenue of current year (12 months)
  const thisYearData = Array(12).fill(0);

  // Revenue of last year (12 months)
  const lastYearData = Array(12).fill(0);

  // Pour data into the correct array
  data.forEach(item => {
    // month in MongoDB starts from 1 -> subtract 1 for correct array index
    const monthIndex = item._id.month - 1;

    // If current year
    if (item._id.year === currentYear) {
      thisYearData[monthIndex] = item.revenue;
    }

    // If last year
    if (item._id.year === lastYear) {
      lastYearData[monthIndex] = item.revenue;
    }
  });

  // x-axis label by month
  const labelsMonth = Array.from(
    { length: 12 },
    (_, i) => `Month ${i + 1}`
  );
  // END REVENUE BY MONTH CHART

  res.render("admin/pages/dashboard-revenue-by-time.pug", {
    pageTitle: "Revenue Over Time",

    labelsHour,
    todayData,
    yesterdayData,

    labelsDay,
    thisMonthData,
    lastMonthData,

    labelsMonth,
    thisYearData,
    lastYearData,
  });
}

const ORDER_STATUS_CONFIG = [
  { key: "pending",   label: "Pending",   color: "#ff9f43" },
  { key: "confirmed", label: "Confirmed", color: "#41cbd8" },
  { key: "shipping",  label: "Shipping",  color: "#7367f0" },
  { key: "completed", label: "Completed", color: "#22c5ad" },
  { key: "cancelled", label: "Cancelled", color: "#ef4d56" },
  { key: "returned",  label: "Returned",  color: "#fd7e14" },
];

const buildPie = (rawData: any[]) => {
  const map = new Map(rawData.map((r: any) => [r._id, r.total]));
  return {
    labels: ORDER_STATUS_CONFIG.map(c => c.label),
    datasets: [{ data: ORDER_STATUS_CONFIG.map(c => map.get(c.key) || 0), backgroundColor: ORDER_STATUS_CONFIG.map(c => c.color) }],
  };
};

export const orderStatisticData = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) { res.json({ code: 'error' }); return; }
  const range = parseCustomRange(from as string, to as string);
  if (!range) { res.json({ code: 'error' }); return; }
  const result = await Order.aggregate([
    { $match: { deleted: false, createdAt: { $gte: range.fromDate, $lte: range.toDate } } },
    { $group: { _id: "$orderStatus", total: { $sum: 1 } } },
  ]);
  res.json({ code: 'success', from, to, pieCustom: buildPie(result) });
};

export const orderStatistic = async (req: Request, res: Response) => {
  // Default — fixed ranges
  const { startToday, endToday, startThisMonth, endThisMonth } = buildDateRanges();
  const vnTime = getVnNow();
  const y = vnTime.getUTCFullYear();
  const startThisYear = tzDate(y, 0, 1, 0, 0, 0, 0);
  const endThisYear   = tzDate(y, 11, 31, 23, 59, 59, 999);

  // Order status today
  const orderStatusToday = await Order.aggregate([
    {
      // Filter orders in today
      $match: {
        deleted: false,
        createdAt: {
          $gte: startToday,
          $lte: endToday
        }
      }
    },
    {
      // Group by order status
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 } // Count orders
      }
    }
  ]);

  // Order status this month
  const orderStatusThisMonth = await Order.aggregate([
    {
      // Filter orders in current month
      $match: {
        deleted: false,
        createdAt: {
          $gte: startThisMonth,
          $lte: endThisMonth
        }
      }
    },
    {
      // Group by order status
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 }
      }
    }
  ]);

  // Order status this year
  const orderStatusThisYear = await Order.aggregate([
    {
      // Filter orders in current year
      $match: {
        deleted: false,
        createdAt: {
          $gte: startThisYear,
          $lte: endThisYear
        }
      }
    },
    {
      // Group by order status
      $group: {
        _id: "$orderStatus",
        total: { $sum: 1 }
      }
    }
  ]);

  const pieToday     = buildPie(orderStatusToday);
  const pieThisMonth = buildPie(orderStatusThisMonth);
  const pieThisYear  = buildPie(orderStatusThisYear);
  
  // Render UI
  res.render("admin/pages/dashboard-order-statistic.pug", {
    pageTitle: "Order Statistics",

    pieToday,
    pieThisMonth,
    pieThisYear,
  });
}

export const topSellingProducts = async (req: Request, res: Response) => {

  /**
   * Goal:
   * - Only take paid & completed orders
   * - Unwind each item in order
   * - Group by product
   * - Calculate total quantity & revenue
   * - Get TOP 10
   */
  const topProducts = await Order.aggregate([
    {
      // Filter valid orders
      $match: {
        paymentStatus: "paid",
        deleted: false
      }
    },
    {
      // Unwind each product in the order
      $unwind: "$items"
    },
    {
      // Group by product
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" }, // product name
        totalQuantity: { $sum: "$items.quantity" }, // total quantity sold
        totalRevenue: {
          $sum: {
            $multiply: ["$items.quantity", "$items.price"]
          }
        }
      }
    },
    {
      // Sort by selling quantity descending
      $sort: { totalQuantity: -1 }
    },
    {
      // Get top 10
      $limit: 10
    }
  ]);

  // Render UI
  res.render("admin/pages/dashboard-top-selling-products.pug", {
    pageTitle: "Top Selling Products",
    topProducts
  });
};

export const customerStatistic = async (req: Request, res: Response) => {
  const { startToday, endToday, startYesterday, endYesterday, startThisMonth, endThisMonth, startLastMonth, endLastMonth } = buildDateRanges();

  // Total customers
  const totalUsers = await AccountUser.countDocuments({
    deleted: false
  });

  // New customers today & yesterday
  const todayUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startToday, $lte: endToday }
  });

  const yesterdayUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startYesterday, $lte: endYesterday }
  });

  const todayPercent = yesterdayUsers === 0 ? 100 : ((todayUsers - yesterdayUsers) / yesterdayUsers) * 100;

  // New customers this month & last month
  const thisMonthUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startThisMonth, $lte: endThisMonth }
  });

  const lastMonthUsers = await AccountUser.countDocuments({
    deleted: false,
    createdAt: { $gte: startLastMonth, $lte: endLastMonth }
  });

  const monthPercent = lastMonthUsers === 0 ? 100 : ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;

  // Top 10 customers spending the most
  const topUsers = await Order.aggregate([
    {
      // Filter valid orders
      $match: {
        paymentStatus: "paid",
        deleted: false
      }
    },
    {
      // Group by userId (string)
      $group: {
        _id: "$userId",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$total" }
      }
    },
    {
      // Sort by total spent
      $sort: { totalSpent: -1 }
    },
    {
      // Get top 10
      $limit: 10
    },
    {
      // Lookup to accounts-user collection
      $lookup: {
        from: "accounts-user",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                // Compare string(userId) with string(_id)
                $eq: [
                  { $toString: "$_id" },
                  "$$userId"
                ]
              }
            }
          }
        ],
        as: "user"
      }
    },
    {
      // Remove records that cannot be joined
      $unwind: "$user"
    },
    {
      // Select fields to use
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$user.fullName",
        phone: "$user.phone",
        totalOrders: 1,
        totalSpent: 1
      }
    }
  ]);
  
  // Render UI
  res.render("admin/pages/dashboard-customer-statistic.pug", {
    pageTitle: "Customer Statistics",
    
    totalUsers,
    todayUsers,
    todayPercent,
    
    thisMonthUsers,
    monthPercent,
    
    topUsers
  });
}