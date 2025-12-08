/**
 * Input validation schemas using Zod
 * Use these schemas to validate request bodies and query parameters
 */

import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Subscription tier validation
 */
export const subscriptionTierSchema = z.enum(["free", "basic", "advanced", "elite"]);

/**
 * Subscription status validation
 */
export const subscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "canceled",
  "past_due",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Email validation
 */
export const emailSchema = z.string().email("Invalid email format");

/**
 * Stripe checkout request validation.
 *
 * New canonical shape:
 * - planCode: "essentials" | "professional" | "executive"
 * - billingInterval: "monthly" | "yearly"
 *
 * Legacy support:
 * - tier: "basic" | "advanced" | "elite" (mapped to planCode server-side)
 */
// Seat data structure for team subscriptions
export const seatDataSchema = z.object({
  tier: subscriptionTierSchema.refine((val) => val !== "free", {
    message: "Free tier is not available for team seats",
  }),
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().optional(),
});

export const stripeCheckoutRequestSchema = z.object({
  // New fields (preferred)
  planCode: z.enum(["essentials", "professional", "executive"]).optional(),
  billingInterval: z.enum(["monthly", "yearly"]).optional().default("monthly"),

  // Legacy fields (for backward compatibility)
  tier: subscriptionTierSchema.optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),

  // Seat count for multi-seat subscriptions
  seatCount: z.number().int().min(1).max(100).optional(),

  // Seat data with emails (for team subscriptions)
  seats: z.array(seatDataSchema).optional(),

  userId: uuidSchema.optional(), // Optional because we'll get it from auth
});

/**
 * Stripe trial start request validation
 */
export const stripeTrialStartRequestSchema = z.object({
  tier: subscriptionTierSchema.refine((val) => val !== "free", {
    message: "Free tier does not support trials",
  }),
  userId: uuidSchema.optional(), // Optional because we'll get it from auth
});

/**
 * Subscription query parameter validation
 */
export const subscriptionQuerySchema = z.object({
  userId: uuidSchema.optional(), // Optional because we'll get it from auth
});

/**
 * Safe error response helper
 * Never leaks stack traces or internal errors to clients
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: unknown
) {
  // Log detailed error server-side only
  if (details) {
    console.error(`[${status}] ${message}:`, details);
  } else {
    console.error(`[${status}] ${message}`);
  }

  // Return safe error message to client
  return NextResponse.json(
    {
      error: message,
      // In development, you might want to include more details
      // In production, never expose internal details
      ...(process.env.NODE_ENV === "development" && details
        ? { details: String(details) }
        : {}),
    },
    { status }
  );
}

/**
 * Validate request body with Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: Response }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        error: createErrorResponse(
          "Invalid request data",
          400,
          result.error.issues
        ),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: createErrorResponse(
        "Invalid JSON in request body",
        400,
        error
      ),
    };
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  url: URL,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: Response } {
  try {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
      return {
        success: false,
        error: createErrorResponse(
          "Invalid query parameters",
          400,
          result.error.issues
        ),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: createErrorResponse(
        "Error parsing query parameters",
        400,
        error
      ),
    };
  }
}

