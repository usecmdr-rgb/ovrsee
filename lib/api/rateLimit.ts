/**
 * Rate Limiting Utility
 * 
 * Simple in-memory rate limiter (for production, use Redis or similar)
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const key in this.store) {
        if (this.store[key].resetAt < now) {
          delete this.store[key];
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request should be rate limited
   * @param identifier - Unique identifier (userId, IP, etc.)
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Object with allowed status and remaining requests
   */
  check(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const key = identifier;
    const entry = this.store[key];

    // If no entry or expired, create new
    if (!entry || entry.resetAt < now) {
      this.store[key] = {
        count: 1,
        resetAt: now + windowMs,
      };
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    // Increment count
    entry.count += 1;

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Get rate limit info without incrementing
   */
  getInfo(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store[identifier];

    if (!entry || entry.resetAt < now) {
      return {
        remaining: maxRequests,
        resetAt: now + windowMs,
      };
    }

    return {
      remaining: Math.max(0, maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Rate limit configuration presets
 */
export const RateLimitPresets = {
  // Per-user limits
  user: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // Per-IP limits (stricter)
  ip: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
  },
  // Strict limits for sensitive operations
  strict: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Webhook limits (more permissive)
  webhook: {
    maxRequests: 1000,
    windowMs: 60 * 1000, // 1 minute
  },
};



