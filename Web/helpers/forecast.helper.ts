// Holt's linear trend method feeds a standard ROP = demand-during-lead-time + safety-stock model (Silver, Pyke & Peterson).

import { FORECAST_CONFIG } from "../configs/forecast.config";
import { mean, stdDev, percentile } from "./statistics.helper";

// Caps outlier days (e.g. a flash-sale spike) so a promo doesn't get read into the baseline as the new normal demand.
export const winsorizeSeries = (
  series: number[],
  cappingPercentile: number = FORECAST_CONFIG.OUTLIER_CAP_PERCENTILE
): number[] => {
  const cap = percentile(series, cappingPercentile);
  if (cap <= 0) return series;
  return series.map((v) => Math.min(v, cap));
};

export interface IHoltForecast {
  level: number;
  trend: number;
  /** One-step-ahead forecast, clamped to non-negative (demand can't be negative). */
  forecast: number;
}

export const holtLinearForecast = (
  series: number[],
  alpha: number = FORECAST_CONFIG.LEVEL_SMOOTHING_ALPHA,
  beta: number = FORECAST_CONFIG.TREND_SMOOTHING_BETA
): IHoltForecast => {
  if (series.length === 0) return { level: 0, trend: 0, forecast: 0 };
  if (series.length === 1) return { level: series[0], trend: 0, forecast: Math.max(0, series[0]) };

  let level = series[0];
  let trend = series[1] - series[0];

  for (let i = 1; i < series.length; i++) {
    const previousLevel = level;
    level = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }

  return { level, trend, forecast: Math.max(0, level + trend) };
};

export interface IReorderForecast {
  forecastedDailyDemand: number;
  demandStdDev: number;
  reorderPoint: number;
  daysOfSupply: number;
  needsReorder: boolean;
  suggestedReorderQty: number;
  /** True when there's too little sales history to trust the trend - forecast falls back to a flat average. */
  insufficientData: boolean;
}

export const computeReorderForecast = (
  rawDailyDemandSeries: number[],
  currentStock: number,
  leadTimeDays: number,
  reviewPeriodDays: number,
  minSaleDaysForTrend: number = FORECAST_CONFIG.MIN_SALE_DAYS_FOR_TREND,
  serviceLevelZ: number = FORECAST_CONFIG.SERVICE_LEVEL_Z,
  outlierCapPercentile: number = FORECAST_CONFIG.OUTLIER_CAP_PERCENTILE
): IReorderForecast => {
  // Skip winsorizing when data's too sparse to tell a real sale from an outlier.
  const nonZeroDays = rawDailyDemandSeries.filter((d) => d > 0).length;
  const insufficientData = nonZeroDays < minSaleDaysForTrend;
  const dailyDemandSeries = insufficientData
    ? rawDailyDemandSeries
    : winsorizeSeries(rawDailyDemandSeries, outlierCapPercentile);

  const forecastedDailyDemand = insufficientData
    ? mean(dailyDemandSeries)
    : holtLinearForecast(dailyDemandSeries).forecast;
  const demandStdDev = stdDev(dailyDemandSeries);

  const safetyStock = serviceLevelZ * demandStdDev * Math.sqrt(leadTimeDays);
  const reorderPoint = forecastedDailyDemand * leadTimeDays + safetyStock;

  const daysOfSupply = forecastedDailyDemand > 0 ? currentStock / forecastedDailyDemand : Infinity;
  const needsReorder = currentStock <= reorderPoint;

  // Target stock covers lead time + one review cycle, plus safety stock.
  const targetStock = forecastedDailyDemand * (leadTimeDays + reviewPeriodDays) + safetyStock;
  const suggestedReorderQty = needsReorder ? Math.max(0, Math.ceil(targetStock - currentStock)) : 0;

  return {
    forecastedDailyDemand,
    demandStdDev,
    reorderPoint,
    daysOfSupply,
    needsReorder,
    suggestedReorderQty,
    insufficientData
  };
};
