/**
 * Forecasting Engine
 * 
 * Simple statistical prediction using moving averages
 */

/**
 * Predict next value using simple moving average
 * 
 * @param values - Historical values (most recent last)
 * @param window - Number of recent values to average (default: 5)
 * @returns Predicted next value
 */
export function predictValue(values: number[], window: number = 5): number {
  if (values.length === 0) return 0;
  if (values.length < window) {
    // Use all available values if we don't have enough
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }
  
  // Use last N values for moving average
  const recent = values.slice(-window);
  const sum = recent.reduce((a, b) => a + b, 0);
  return sum / recent.length;
}

/**
 * Predict next value using weighted moving average
 * (More recent values have higher weight)
 */
export function predictValueWeighted(values: number[], window: number = 5): number {
  if (values.length === 0) return 0;
  if (values.length < window) {
    return predictValue(values, values.length);
  }
  
  const recent = values.slice(-window);
  let weightedSum = 0;
  let weightSum = 0;
  
  recent.forEach((value, index) => {
    const weight = index + 1; // More recent = higher weight
    weightedSum += value * weight;
    weightSum += weight;
  });
  
  return weightedSum / weightSum;
}

/**
 * Predict next value using exponential smoothing
 */
export function predictValueExponential(values: number[], alpha: number = 0.3): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  let forecast = values[0];
  
  for (let i = 1; i < values.length; i++) {
    forecast = alpha * values[i] + (1 - alpha) * forecast;
  }
  
  return forecast;
}

/**
 * Predict trend continuation
 * Returns predicted value and confidence (0-1)
 */
export function predictTrend(
  values: number[],
  method: 'simple' | 'weighted' | 'exponential' = 'simple'
): { value: number; confidence: number } {
  if (values.length < 3) {
    return { value: values.length > 0 ? values[values.length - 1] : 0, confidence: 0.3 };
  }
  
  let predicted: number;
  switch (method) {
    case 'weighted':
      predicted = predictValueWeighted(values);
      break;
    case 'exponential':
      predicted = predictValueExponential(values);
      break;
    default:
      predicted = predictValue(values);
  }
  
  // Calculate confidence based on data consistency
  const recent = values.slice(-5);
  const variance = calculateVariance(recent);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const coefficientOfVariation = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
  
  // Lower variance = higher confidence
  const confidence = Math.max(0.3, Math.min(0.9, 1 - coefficientOfVariation));
  
  return { value: predicted, confidence };
}

/**
 * Calculate variance of values
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Generate forecast insights
 * 
 * @param metricName - Name of the metric (e.g., "missed calls")
 * @param values - Historical values
 * @param unit - Unit of measurement (e.g., "calls", "hours")
 * @returns Human-readable forecast message
 */
export function generateForecastMessage(
  metricName: string,
  values: number[],
  unit: string = ''
): string {
  if (values.length < 3) {
    return `Insufficient data to forecast ${metricName}.`;
  }
  
  const { value, confidence } = predictTrend(values);
  const confidencePercent = Math.round(confidence * 100);
  
  return `If trend continues, ${metricName} next period: ~${Math.round(value)}${unit ? ` ${unit}` : ''} (${confidencePercent}% confidence)`;
}



