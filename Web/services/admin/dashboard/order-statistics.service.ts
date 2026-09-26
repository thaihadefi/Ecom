import Order from '../../../models/order.model';
import { metadataCache } from '../../../helpers/metadata-cache.helper';
import { buildDateRanges, parseCustomRange, storeDate, storeToday } from './dashboard-time';

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
  const y = storeToday().year;
  const startThisYear = storeDate(y, 0, 1);
  const endThisYear = storeDate(y, 11, 31, 23, 59, 59, 999);

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
