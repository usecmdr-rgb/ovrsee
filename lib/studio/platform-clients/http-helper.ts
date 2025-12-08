/**
 * Shared HTTP helper for platform API calls
 * Provides consistent error handling, logging, and retry logic
 */

import { logPlatformAPICall } from "@/lib/studio/logging";
import { PlatformAPIError, TokenExpiredError, RateLimitError } from "@/lib/studio/errors";
import type { HTTPRequestOptions, HTTPResponse } from "./types";

/**
 * Make an HTTP request to a platform API
 * Handles authentication, logging, and error transformation
 */
export async function callPlatformAPI<T = any>(
  platform: "instagram" | "facebook" | "tiktok",
  options: HTTPRequestOptions,
  context: {
    workspaceId: string;
    baseUrl: string;
    apiVersion: string;
  }
): Promise<HTTPResponse<T>> {
  const startTime = Date.now();
  const { method, path, accessToken, body, params, headers = {} } = options;

  // Build full URL
  const url = new URL(`${context.baseUrl}/${context.apiVersion}${path}`);
  
  // Add query params
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Add access token to query params (Facebook/Instagram) or headers (TikTok)
  if (platform === "tiktok") {
    headers["Authorization"] = `Bearer ${accessToken}`;
  } else {
    url.searchParams.append("access_token", accessToken);
  }

  // Prepare request options
  const requestOptions: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  // Handle body: TikTok uses JSON, Facebook/Instagram use query params for POST
  if (body && method !== "GET") {
    if (platform === "tiktok") {
      // TikTok uses JSON body
      requestOptions.headers = {
        ...requestOptions.headers,
        "Content-Type": "application/json",
      };
      requestOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    } else {
      // Facebook/Instagram: if body is provided, it means we want to send it as JSON
      // Otherwise, params are already in URL query string
      if (Object.keys(body).length > 0 && typeof body === "object") {
        requestOptions.headers = {
          ...requestOptions.headers,
          "Content-Type": "application/json",
        };
        requestOptions.body = JSON.stringify(body);
      }
    }
  }

  try {
    const response = await fetch(url.toString(), requestOptions);
    const durationMs = Date.now() - startTime;

    // Parse response
    let responseData: T | undefined;
    let errorText: string | undefined;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else {
        errorText = await response.text();
      }
    } catch (parseError) {
      errorText = "Failed to parse response";
    }

    // Log the API call
    await logPlatformAPICall(
      context.workspaceId,
      platform,
      path,
      method,
      response.ok,
      response.status,
      response.ok ? undefined : (errorText || JSON.stringify(responseData)),
      durationMs
    );

    // Handle errors
    if (!response.ok) {
      // Check for token expiry
      if (response.status === 401) {
        throw new TokenExpiredError(platform, {
          workspaceId: context.workspaceId,
          metadata: { endpoint: path, method, statusCode: response.status },
        });
      }

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
        throw new RateLimitError(platform, {
          workspaceId: context.workspaceId,
          retryAfter: retryAfterSeconds,
          metadata: { endpoint: path, method, statusCode: response.status },
        });
      }

      // Other API errors
      const isRetryable = response.status >= 500 || response.status === 429;
      throw new PlatformAPIError(platform, `API request failed: ${errorText || response.statusText}`, {
        workspaceId: context.workspaceId,
        statusCode: response.status,
        retryable: isRetryable,
        metadata: {
          endpoint: path,
          method,
          responseBody: responseData,
          errorText,
        },
      });
    }

    return {
      ok: true,
      status: response.status,
      data: responseData,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Log failed request
    await logPlatformAPICall(
      context.workspaceId,
      platform,
      path,
      method,
      false,
      error.statusCode || 0,
      error.message,
      durationMs
    );

    // Re-throw typed errors
    if (error instanceof TokenExpiredError || error instanceof RateLimitError || error instanceof PlatformAPIError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new PlatformAPIError(platform, error.message || "Unknown error", {
      workspaceId: context.workspaceId,
      retryable: true,
      metadata: { endpoint: path, method, originalError: error.message },
      cause: error,
    });
  }
}

/**
 * Helper for GET requests
 */
export async function getPlatformAPI<T = any>(
  platform: "instagram" | "facebook" | "tiktok",
  path: string,
  accessToken: string,
  context: {
    workspaceId: string;
    baseUrl: string;
    apiVersion: string;
  },
  params?: Record<string, string>
): Promise<HTTPResponse<T>> {
  return callPlatformAPI<T>(platform, {
    method: "GET",
    path,
    accessToken,
    params,
  }, context);
}

/**
 * Helper for POST requests
 */
export async function postPlatformAPI<T = any>(
  platform: "instagram" | "facebook" | "tiktok",
  path: string,
  accessToken: string,
  body: any,
  context: {
    workspaceId: string;
    baseUrl: string;
    apiVersion: string;
  },
  params?: Record<string, string>
): Promise<HTTPResponse<T>> {
  return callPlatformAPI<T>(platform, {
    method: "POST",
    path,
    accessToken,
    body,
    params,
  }, context);
}

/**
 * Helper for PUT requests
 */
export async function putPlatformAPI<T = any>(
  platform: "instagram" | "facebook" | "tiktok",
  path: string,
  accessToken: string,
  body: any,
  context: {
    workspaceId: string;
    baseUrl: string;
    apiVersion: string;
  },
  params?: Record<string, string>
): Promise<HTTPResponse<T>> {
  return callPlatformAPI<T>(platform, {
    method: "PUT",
    path,
    accessToken,
    body,
    params,
  }, context);
}

