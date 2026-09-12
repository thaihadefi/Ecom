export const mean = (series: number[]): number => {
  if (series.length === 0) return 0;
  return series.reduce((sum, v) => sum + v, 0) / series.length;
};

export const stdDev = (series: number[]): number => {
  if (series.length < 2) return 0;
  const avg = mean(series);
  const variance = series.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (series.length - 1);
  return Math.sqrt(variance);
};

/** Nearest-rank percentile: series need not be pre-sorted. */
export const percentile = (series: number[], p: number): number => {
  if (series.length === 0) return 0;
  const sorted = [...series].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};
