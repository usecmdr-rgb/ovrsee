/**
 * API Middleware Utilities
 * 
 * Common middleware functions for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { rateLimiter, RateLimitPresets } from "./rateLimit";
import { logger } from "./logger";
import { Errors, withErrorHandler } from "./errors";

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<{
  userId: string;
  email: string;
} | null> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getSupabaseServerClient();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || "",
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication middleware
 */
export function requireAuth(handler: (request: NextRequest, userId: string) => Promise<NextResponse>) {
  return withErrorHandler(async (request: NextRequest) => {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      throw Errors.Unauthorized();
    }

    return handler(request, user.userId);
  });
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  preset: keyof typeof RateLimitPresets = "user"
) {
  return withErrorHandler(async (request: NextRequest) => {
    // Get identifier (userId if authenticated, otherwise IP)
    const user = await getAuthenticatedUser(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
               request.headers.get("x-real-ip") || 
               "unknown";
    const identifier = user?.userId || ip;
    
    const config = RateLimitPresets[preset];
    const result = rateLimiter.check(identifier, config.maxRequests, config.windowMs);

    if (!result.allowed) {
      throw Errors.TooManyRequests(
        `Rate limit exceeded. Try again after ${new Date(result.resetAt).toISOString()}`
      );
    }

    // Add rate limit headers
    const response = await handler(request);
    response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.resetAt.toString());

    return response;
  });
}

/**
 * Request logging middleware
 */
export function withLogging(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;
    const requestId = crypto.randomUUID();

    try {
      const user = await getAuthenticatedUser(request);
      const response = await handler(request);
      const duration = Date.now() - startTime;

      logger.request(method, path, response.status, duration, {
        requestId,
        userId: user?.userId,
      });

      response.headers.set("X-Request-ID", requestId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Request failed", error, {
        requestId,
        method,
        path,
        durationMs: duration,
      });
      throw error;
    }
  };
}

/**
 * Combine multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<(handler: (request: NextRequest) => Promise<NextResponse>) => (request: NextRequest) => Promise<NextResponse>>
) {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}




