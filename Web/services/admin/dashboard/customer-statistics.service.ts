import Order from '../../../models/order.model';
import AccountUser from '../../../models/account-user.model';
import { metadataCache } from '../../../helpers/metadata-cache.helper';
import { percentChange } from './dashboard-shared';
import { buildDateRanges } from './dashboard-time';

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

  const todayPercent = percentChange(todayUsers, yesterdayUsers);
  const monthPercent = percentChange(thisMonthUsers, lastMonthUsers);

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
