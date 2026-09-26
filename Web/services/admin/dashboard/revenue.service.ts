import Order from '../../../models/order.model';
import { metadataCache } from '../../../helpers/metadata-cache.helper';
import { buildDateRanges, parseCustomRange, reportTimezone, storeDate, storeDayOfMonth, storeToday } from './dashboard-time';

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

export const buildRevenueRangeData = async (from: string, to: string) => {
  const range = parseCustomRange(from, to);
  if (!range) return null;
  const { fromDate, toDate, granularity, fy, fm, fd, ty, tm, td } = range;

  let groupId: Record<string, unknown>;
  let sortKey: Record<string, 1 | -1>;
  if (granularity === 'hour') {
    groupId = { hour: { $hour: { date: "$createdAt", timezone: reportTimezone() } } };
    sortKey = { "_id.hour": 1 };
  } else if (granularity === 'day') {
    groupId = {
      year: { $year: { date: "$createdAt", timezone: reportTimezone() } },
      month: { $month: { date: "$createdAt", timezone: reportTimezone() } },
      day: { $dayOfMonth: { date: "$createdAt", timezone: reportTimezone() } },
    };
    sortKey = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
  } else {
    groupId = {
      year: { $year: { date: "$createdAt", timezone: reportTimezone() } },
      month: { $month: { date: "$createdAt", timezone: reportTimezone() } },
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
    // Walks calendar days in UTC so the server's own time zone cannot skip or repeat a day.
    const cursor = new Date(Date.UTC(fy, fm - 1, fd));
    const end = new Date(Date.UTC(ty, tm - 1, td));
    while (cursor <= end) {
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}-${cursor.getUTCDate()}`;
      labels.push(`${cursor.getUTCDate()}/${cursor.getUTCMonth() + 1}`);
      data.push((dayMap.get(key) as number) || 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
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
                timezone: reportTimezone()
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

  const daysInThisMonth = storeDayOfMonth(endThisMonth);
  const daysInLastMonth = storeDayOfMonth(endLastMonth);

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
                timezone: reportTimezone()
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

  const currentYear = storeToday().year;
  const lastYear = currentYear - 1;
  const startLastYear = storeDate(lastYear, 0, 1);
  const endCurrentYear = storeDate(currentYear, 11, 31, 23, 59, 59, 999);

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
        year: { $year: { date: "$createdAt", timezone: reportTimezone() } },
        month: { $month: { date: "$createdAt", timezone: reportTimezone() } },
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
