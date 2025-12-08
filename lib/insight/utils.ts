/**
 * Utility functions for Insight Agent
 */

export type TimeRange = 'daily' | 'weekly' | 'monthly';

/**
 * Calculate start and end timestamps for a given time range
 */
export function getTimeRangeBounds(
  range: TimeRange,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = new Date(now);
  const end = new Date(now);

  switch (range) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Start of week (Monday)
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      // End of week (Sunday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      // Start of month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // End of month
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString();
}

/**
 * Get source icon/label for insights
 */
export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    aloha: 'Aloha',
    sync: 'Sync',
    studio: 'Studio',
    insight_agent: 'Insight',
    system: 'System',
    manual: 'Manual',
  };
  return labels[source] || source;
}

/**
 * Get severity color class
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'info':
    default:
      return 'bg-blue-500';
  }
}

/**
 * Get category color class
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    productivity: 'bg-emerald-500',
    communication: 'bg-blue-500',
    finance: 'bg-green-500',
    sales: 'bg-purple-500',
    risk: 'bg-red-500',
    ops: 'bg-orange-500',
    misc: 'bg-slate-500',
  };
  return colors[category] || 'bg-slate-500';
}




