/**
 * Studio API Error Response Helper
 * 
 * Standardized error handling for Studio API routes.
 */

import { StudioError, getUserFriendlyMessage } from "./errors";
import { logError } from "./logging";
import { NextResponse } from "next/server";

export interface ApiErrorContext {
  workspaceId?: string;
  route: string;
  postId?: string;
  experimentId?: string;
  campaignId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Handle API errors consistently
 * 
 * Logs the error and returns a standardized JSON response.
 */
export async function handleApiError(
  e: unknown,
  context: ApiErrorContext
): Promise<NextResponse> {
  let type = "UnknownError";
  let message = "Something went wrong.";
  let details: any = {};
  let statusCode = 500;

  if (e instanceof StudioError) {
    type = e.name;
    message = getUserFriendlyMessage(e);
    details = e.metadata || {};
    statusCode = 400; // Client errors
  } else if (e instanceof Error) {
    type = e.name;
    message = e.message;
    details = { stack: e.stack };
  }

  // Log the error
  await logError("api_error", {
    route: context.route,
    workspace_id: context.workspaceId,
    post_id: context.postId,
    experiment_id: context.experimentId,
    campaign_id: context.campaignId,
    user_id: context.userId,
    error_type: type,
    error_message: message,
    error_details: details,
  });

  return NextResponse.json(
    {
      ok: false,
      error: true,
      type,
      message,
      details: process.env.NODE_ENV === "development" ? details : undefined, // Only include details in dev
    },
    { status: statusCode }
  );
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandling(
  handler: (request: any, context: any) => Promise<NextResponse>,
  routeName: string
) {
  return async (request: any, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Extract context from request if possible
      const errorContext: ApiErrorContext = {
        route: routeName,
        // Add more context extraction here if needed
      };

      return await handleApiError(error, errorContext);
    }
  };
}

