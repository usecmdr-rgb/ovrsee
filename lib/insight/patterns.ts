/**
 * Pattern Comparison Engine
 * 
 * Utilities for comparing data across time periods
 */

export interface ComparisonResult {
  delta: number;
  percent: number;
  trend: 'up' | 'down' | 'flat';
}

/**
 * Compare current value to previous period
 */
export function compareToPreviousPeriod(
  current: number,
  previous: number
): ComparisonResult {
  const delta = current - previous;
  
  // Calculate percentage change
  let percent = 0;
  if (previous === 0) {
    percent = current > 0 ? 100 : 0;
  } else {
    percent = (delta / previous) * 100;
  }
  
  // Determine trend
  let trend: 'up' | 'down' | 'flat';
  if (Math.abs(percent) < 5) {
    trend = 'flat';
  } else if (delta > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }
  
  return {
    delta,
    percent: Math.round(percent * 10) / 10, // Round to 1 decimal
    trend,
  };
}

/**
 * Compare arrays of values (e.g., daily stats over time)
 */
export function compareTimeSeries(
  current: number[],
  previous: number[]
): ComparisonResult {
  const currentSum = current.reduce((a, b) => a + b, 0);
  const previousSum = previous.reduce((a, b) => a + b, 0);
  
  return compareToPreviousPeriod(currentSum, previousSum);
}

/**
 * Detect anomalies in a time series
 * Returns indices where values are significantly different from average
 */
export function detectAnomalies(
  values: number[],
  threshold: number = 2 // Standard deviations
): number[] {
  if (values.length < 3) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  const anomalies: number[] = [];
  values.forEach((value, index) => {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > threshold) {
      anomalies.push(index);
    }
  });
  
  return anomalies;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], window: number = 5): number[] {
  if (values.length === 0) return [];
  if (values.length < window) return values;
  
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Detect trend direction in time series
 */
export function detectTrend(values: number[]): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  
  // Use linear regression to determine trend
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  if (Math.abs(slope) < 0.1) return 'flat';
  return slope > 0 ? 'up' : 'down';
}



