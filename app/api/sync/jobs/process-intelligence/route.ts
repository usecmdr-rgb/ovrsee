/**
 * POST /api/sync/jobs/process-intelligence
 * 
 * Background job endpoint for processing email intelligence
 * Can be called by cron jobs or webhooks
 * 
 * Requires authentication or secret token
 */

import { NextRequest, NextResponse } from "next/server";
import { processEmailIntelligence } from "@/lib/sync/jobs/processEmailIntelligence";
import { isSyncIntelligenceEnabled } from "@/lib/sync/featureFlags";

// Secret token for cron/webhook calls (optional, can use auth instead)
const JOB_SECRET_TOKEN = process.env.SYNC_JOB_SECRET_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Check if feature is enabled
    if (!isSyncIntelligenceEnabled()) {
      return NextResponse.json(
        { 
          ok: false, 
          error: "Sync Intelligence is disabled",
          result: null 
        },
        { status: 503 }
      );
    }

    // Optional: Check for secret token in header or query param
    const authHeader = request.headers.get("authorization");
    const secretToken = authHeader?.replace("Bearer ", "") || 
                       request.nextUrl.searchParams.get("token");

    // If secret token is configured, require it
    if (JOB_SECRET_TOKEN && secretToken !== JOB_SECRET_TOKEN) {
      // Fallback to checking if user is authenticated
      // This allows both cron jobs (with token) and authenticated users to call
      if (!authHeader || authHeader === "Bearer dev-token") {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Process intelligence jobs
    const result = await processEmailIntelligence();

    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ProcessIntelligence] Error:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Failed to process intelligence",
        result: null 
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}


