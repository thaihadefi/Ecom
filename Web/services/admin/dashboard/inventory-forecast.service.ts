import Order from '../../../models/order.model';
import Product from '../../../models/product.model';
import { metadataCache } from '../../../helpers/metadata-cache.helper';
import { computeReorderForecast, IReorderForecast } from '../../../helpers/forecast.helper';
import { FORECAST_CONFIG } from '../../../configs/forecast.config';
import { reportTimezone, storeDate, storeDayKey, storeToday } from './dashboard-time';

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

const FORECAST_LOOKBACK_DAYS = FORECAST_CONFIG.LOOKBACK_DAYS;
const FORECAST_LEAD_TIME_DAYS = FORECAST_CONFIG.LEAD_TIME_DAYS;
const FORECAST_REVIEW_PERIOD_DAYS = FORECAST_CONFIG.REVIEW_PERIOD_DAYS;

export const getInventoryForecast = async (): Promise<InventoryForecastResult> => {
  const cacheKey = "admin:dashboard:inventory_forecast";
  const cached = metadataCache.get<InventoryForecastResult>(cacheKey);
  if (cached) return cached;

  const today = storeToday();
  const endDate = storeDate(today.year, today.month, today.day, 23, 59, 59, 999);
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
          day: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: reportTimezone() } }
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
    dayKeys.push(storeDayKey(new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000)));
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
    if (a.daysOfSupply === b.daysOfSupply) return 0;
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
