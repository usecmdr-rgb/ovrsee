/**
 * Standard API Error Handling
 * 
 * Provides consistent error response format across all API routes
 */

import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  message: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Standard error response format
 */
export class ApiErrorResponse extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiErrorResponse";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toResponse(): NextResponse<ApiError> {
    return NextResponse.json(
      {
        error: this.name,
        message: this.message,
        code: this.code,
        details: this.details,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Common error responses
 */
export const Errors = {
  // Authentication & Authorization
  Unauthorized: (message: string = "Authentication required") =>
    new ApiErrorResponse(message, 401, "UNAUTHORIZED"),
  
  Forbidden: (message: string = "Insufficient permissions") =>
    new ApiErrorResponse(message, 403, "FORBIDDEN"),
  
  // Not Found
  NotFound: (resource: string = "Resource") =>
    new ApiErrorResponse(`${resource} not found`, 404, "NOT_FOUND"),
  
  // Validation
  BadRequest: (message: string = "Invalid request") =>
    new ApiErrorResponse(message, 400, "BAD_REQUEST"),
  
  ValidationError: (errors: Record<string, string[]>) =>
    new ApiErrorResponse("Validation failed", 400, "VALIDATION_ERROR", { errors }),
  
  // Server Errors
  InternalServerError: (message: string = "An internal error occurred") =>
    new ApiErrorResponse(message, 500, "INTERNAL_SERVER_ERROR"),
  
  ServiceUnavailable: (message: string = "Service temporarily unavailable") =>
    new ApiErrorResponse(message, 503, "SERVICE_UNAVAILABLE"),
  
  // Rate Limiting
  TooManyRequests: (message: string = "Too many requests") =>
    new ApiErrorResponse(message, 429, "TOO_MANY_REQUESTS"),
};

/**
 * Error handler wrapper for API routes
 * Catches errors and returns standardized responses
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[API Error]", error);

      if (error instanceof ApiErrorResponse) {
        return error.toResponse();
      }

      if (error instanceof Error) {
        return Errors.InternalServerError(error.message).toResponse();
      }

      return Errors.InternalServerError().toResponse();
    }
  };
}



