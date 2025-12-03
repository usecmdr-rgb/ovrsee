/**
 * Health Check Endpoint
 * 
 * GET /api/health
 * Returns system health status for monitoring and uptime checks
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isTwilioConfigured, isGmailConfigured, isOpenAIConfigured, isStripeConfigured } from "@/lib/config/env";

export async function GET() {
  const checks: Record<string, { status: "healthy" | "degraded" | "unhealthy"; message?: string }> = {};
  const startTime = Date.now();

  // Database check
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.database = {
      status: error ? "unhealthy" : "healthy",
      message: error ? error.message : undefined,
    };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Service configuration checks
  checks.twilio = {
    status: isTwilioConfigured ? "healthy" : "degraded",
    message: isTwilioConfigured ? undefined : "Twilio not configured",
  };

  checks.gmail = {
    status: isGmailConfigured ? "healthy" : "degraded",
    message: isGmailConfigured ? undefined : "Gmail OAuth not configured",
  };

  checks.openai = {
    status: isOpenAIConfigured ? "healthy" : "degraded",
    message: isOpenAIConfigured ? undefined : "OpenAI not configured",
  };

  checks.stripe = {
    status: isStripeConfigured ? "healthy" : "degraded",
    message: isStripeConfigured ? undefined : "Stripe not configured",
  };

  // Determine overall status
  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  const anyUnhealthy = Object.values(checks).some((c) => c.status === "unhealthy");

  const overallStatus = anyUnhealthy ? "unhealthy" : allHealthy ? "healthy" : "degraded";

  const responseTime = Date.now() - startTime;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      checks,
    },
    {
      status: overallStatus === "unhealthy" ? 503 : 200,
    }
  );
}



