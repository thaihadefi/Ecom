import { metadataCache } from '../../../helpers/metadata-cache.helper';

// Change versus the previous period; nothing before and nothing now is no change, not +100%.
export const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

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
