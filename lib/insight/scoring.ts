/**
 * Insight Health Score Calculation
 * 
 * Calculates a 0-100 health score based on various metrics
 */

export interface InsightHealthData {
  missedCalls: number;
  overdueEmails: number;
  unreadImportantEmails: number;
  overdueTasks: number;
  customerSentiment: number; // 0-1 scale (0 = negative, 1 = positive)
  responseTimeAvg: number; // in hours
}

/**
 * Calculate Insight Health Score (0-100)
 * 
 * Starts at 100 and subtracts penalties for:
 * - Missed calls
 * - Overdue emails
 * - Unread important emails
 * - Negative sentiment
 * - Slow response time
 * - Overdue tasks
 */
export function calculateInsightHealth(data: InsightHealthData): number {
  let score = 100;
  
  // Missed calls penalty (max -20 points)
  // 0 missed = 0 penalty, 10+ missed = -20 penalty
  const missedCallsPenalty = Math.min(data.missedCalls * 2, 20);
  score -= missedCallsPenalty;
  
  // Overdue emails penalty (max -15 points)
  // 0 overdue = 0 penalty, 5+ overdue = -15 penalty
  const overdueEmailsPenalty = Math.min(data.overdueEmails * 3, 15);
  score -= overdueEmailsPenalty;
  
  // Unread important emails penalty (max -15 points)
  // 0 unread = 0 penalty, 5+ unread = -15 penalty
  const unreadImportantPenalty = Math.min(data.unreadImportantEmails * 3, 15);
  score -= unreadImportantPenalty;
  
  // Negative sentiment penalty (max -20 points)
  // sentiment 0.5-1.0 = 0 penalty, 0.0-0.5 = up to -20 penalty
  if (data.customerSentiment < 0.5) {
    const sentimentPenalty = (0.5 - data.customerSentiment) * 40; // 0.0 sentiment = -20, 0.5 sentiment = 0
    score -= Math.min(sentimentPenalty, 20);
  }
  
  // Slow response time penalty (max -15 points)
  // < 2 hours = 0 penalty, > 6 hours = -15 penalty
  if (data.responseTimeAvg > 2) {
    const responseTimePenalty = Math.min((data.responseTimeAvg - 2) * 3.75, 15);
    score -= responseTimePenalty;
  }
  
  // Overdue tasks penalty (max -15 points)
  // 0 overdue = 0 penalty, 5+ overdue = -15 penalty
  const overdueTasksPenalty = Math.min(data.overdueTasks * 3, 15);
  score -= overdueTasksPenalty;
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get health score color class
 */
export function getHealthScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get health score background color class
 */
export function getHealthScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-100 dark:bg-green-900/20';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/20';
  return 'bg-red-100 dark:bg-red-900/20';
}

/**
 * Get health score label
 */
export function getHealthScoreLabel(score: number): string {
  if (score >= 70) return 'Excellent';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}

/**
 * Get health score trend message
 */
export function getHealthScoreTrendMessage(
  currentScore: number,
  previousScore: number | null
): string | null {
  if (previousScore === null) return null;
  
  const diff = currentScore - previousScore;
  if (Math.abs(diff) < 2) return null; // No significant change
  
  if (diff > 0) {
    return `Your communication efficiency improved ${diff > 10 ? 'significantly' : ''} today.`;
  } else {
    return `Your communication efficiency declined ${Math.abs(diff) > 10 ? 'significantly' : ''} today.`;
  }
}




