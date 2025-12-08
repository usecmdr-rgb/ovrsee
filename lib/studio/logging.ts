/**
 * Studio Logging Service
 * 
 * Standardized logging for Studio operations.
 * Logs to both console (Vercel logs) and optionally to database.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LogLevel = "info" | "warn" | "error";

export interface LogData {
  workspace_id?: string;
  post_id?: string;
  experiment_id?: string;
  campaign_id?: string;
  platform?: string;
  tool?: string;
  error_code?: string;
  retry_count?: number;
  duration_ms?: number;
  [key: string]: any; // Allow additional fields
}

/**
 * Log an event to console and optionally to database
 */
export async function logStudioEvent(
  level: LogLevel,
  event: string,
  data: LogData = {},
  supabaseClient?: SupabaseClient
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[Studio ${level.toUpperCase()}] ${event}`;
  
  // Always log to console (Vercel logs)
  const consoleData = {
    ...data,
    timestamp,
    event,
  };

  switch (level) {
    case "info":
      console.log(logMessage, consoleData);
      break;
    case "warn":
      console.warn(logMessage, consoleData);
      break;
    case "error":
      console.error(logMessage, consoleData);
      break;
  }

  // Optionally log to database (non-blocking)
  try {
    const supabase = supabaseClient || getSupabaseServerClient();
    
    // Only log errors and warnings to DB to avoid spam
    // Info logs go to console only
    if (level === "error" || level === "warn") {
      await supabase.from("studio_logs").insert({
        workspace_id: data.workspace_id || null,
        event,
        level,
        data: {
          ...data,
          timestamp,
        },
      }).then(({ error }) => {
        if (error) {
          // Don't throw - logging failures shouldn't break the app
          console.error("Failed to write log to database:", error);
        }
      });
    }
  } catch (error) {
    // Silently fail - logging shouldn't break the app
    console.error("Error in logStudioEvent:", error);
  }
}

/**
 * Convenience functions
 */
export async function logInfo(
  event: string,
  data: LogData = {},
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logStudioEvent("info", event, data, supabaseClient);
}

export async function logWarn(
  event: string,
  data: LogData = {},
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logStudioEvent("warn", event, data, supabaseClient);
}

export async function logError(
  event: string,
  data: LogData = {},
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logStudioEvent("error", event, data, supabaseClient);
}

/**
 * Log a tool call (for Studio Agent)
 */
export async function logToolCall(
  workspaceId: string,
  userId: string,
  tool: string,
  args: any,
  result: { success: boolean; message: string; error?: string },
  durationMs?: number,
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logInfo(
    "agent_tool_call",
    {
      workspace_id: workspaceId,
      user_id: userId,
      tool,
      args,
      success: result.success,
      error: result.error,
      duration_ms: durationMs,
    },
    supabaseClient
  );
}

/**
 * Log an API call to external platform
 */
export async function logPlatformAPICall(
  workspaceId: string,
  platform: string,
  endpoint: string,
  method: string,
  success: boolean,
  statusCode?: number,
  error?: string,
  durationMs?: number,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const level = success ? "info" : "error";
  await logStudioEvent(
    level,
    "platform_api_call",
    {
      workspace_id: workspaceId,
      platform,
      endpoint,
      method,
      success,
      status_code: statusCode,
      error,
      duration_ms: durationMs,
    },
    supabaseClient
  );
}

/**
 * Log a retry attempt
 */
export async function logRetry(
  event: string,
  attempt: number,
  maxAttempts: number,
  error: string,
  data: LogData = {},
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logWarn(
    "retry_attempt",
    {
      ...data,
      event,
      attempt,
      max_attempts: maxAttempts,
      error,
    },
    supabaseClient
  );
}

