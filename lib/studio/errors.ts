/**
 * Studio Error Types
 * 
 * Typed error classes for Studio operations.
 * Provides structured error handling with contextual metadata.
 */

export class StudioError extends Error {
  public readonly code: string;
  public readonly workspaceId?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    options?: {
      workspaceId?: string;
      metadata?: Record<string, any>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "StudioError";
    this.code = code;
    this.workspaceId = options?.workspaceId;
    this.metadata = options?.metadata;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      workspaceId: this.workspaceId,
      metadata: this.metadata,
    };
  }
}

/**
 * Platform API Error
 * Thrown when social media platform APIs return errors
 */
export class PlatformAPIError extends StudioError {
  public readonly platform: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    platform: string,
    message: string,
    options?: {
      workspaceId?: string;
      statusCode?: number;
      retryable?: boolean;
      metadata?: Record<string, any>;
      cause?: Error;
    }
  ) {
    super(
      message,
      "PLATFORM_API_ERROR",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          platform,
          statusCode: options?.statusCode,
        },
        cause: options?.cause,
      }
    );
    this.name = "PlatformAPIError";
    this.platform = platform;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? true; // Default to retryable
  }
}

/**
 * Token Expired Error
 * Thrown when OAuth tokens have expired
 */
export class TokenExpiredError extends StudioError {
  public readonly platform: string;

  constructor(
    platform: string,
    options?: {
      workspaceId?: string;
      metadata?: Record<string, any>;
    }
  ) {
    super(
      `Token expired for ${platform}`,
      "TOKEN_EXPIRED",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          platform,
        },
      }
    );
    this.name = "TokenExpiredError";
    this.platform = platform;
  }
}

/**
 * LLM Output Error
 * Thrown when LLM returns invalid or unparseable output
 */
export class LLMOutputError extends StudioError {
  public readonly rawOutput?: string;
  public readonly expectedFormat?: string;

  constructor(
    message: string,
    options?: {
      workspaceId?: string;
      rawOutput?: string;
      expectedFormat?: string;
      metadata?: Record<string, any>;
      cause?: Error;
    }
  ) {
    super(
      message,
      "LLM_OUTPUT_ERROR",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          rawOutput: options?.rawOutput,
          expectedFormat: options?.expectedFormat,
        },
        cause: options?.cause,
      }
    );
    this.name = "LLMOutputError";
    this.rawOutput = options?.rawOutput;
    this.expectedFormat = options?.expectedFormat;
  }
}

/**
 * Invalid Input Error
 * Thrown when user input fails validation
 */
export class InvalidInputError extends StudioError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    message: string,
    options?: {
      workspaceId?: string;
      field?: string;
      value?: any;
      metadata?: Record<string, any>;
    }
  ) {
    super(
      message,
      "INVALID_INPUT",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          field: options?.field,
          value: options?.value,
        },
      }
    );
    this.name = "InvalidInputError";
    this.field = options?.field;
    this.value = options?.value;
  }
}

/**
 * Missing Data Error
 * Thrown when required data is not found
 */
export class MissingDataError extends StudioError {
  public readonly resourceType: string;
  public readonly resourceId?: string;

  constructor(
    resourceType: string,
    options?: {
      workspaceId?: string;
      resourceId?: string;
      metadata?: Record<string, any>;
    }
  ) {
    super(
      `${resourceType} not found${options?.resourceId ? `: ${options.resourceId}` : ""}`,
      "MISSING_DATA",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          resourceType,
          resourceId: options?.resourceId,
        },
      }
    );
    this.name = "MissingDataError";
    this.resourceType = resourceType;
    this.resourceId = options?.resourceId;
  }
}

/**
 * Permission Error
 * Thrown when user doesn't have permission for an operation
 */
export class PermissionError extends StudioError {
  public readonly operation: string;

  constructor(
    operation: string,
    options?: {
      workspaceId?: string;
      metadata?: Record<string, any>;
    }
  ) {
    super(
      `Permission denied for operation: ${operation}`,
      "PERMISSION_ERROR",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          operation,
        },
      }
    );
    this.name = "PermissionError";
    this.operation = operation;
  }
}

/**
 * Rate Limit Error
 * Thrown when platform API rate limit is hit
 */
export class RateLimitError extends StudioError {
  public readonly platform: string;
  public readonly retryAfter?: number; // seconds

  constructor(
    platform: string,
    options?: {
      workspaceId?: string;
      retryAfter?: number;
      metadata?: Record<string, any>;
    }
  ) {
    super(
      `Rate limit exceeded for ${platform}${options?.retryAfter ? `. Retry after ${options.retryAfter}s` : ""}`,
      "RATE_LIMIT_ERROR",
      {
        workspaceId: options?.workspaceId,
        metadata: {
          ...options?.metadata,
          platform,
          retryAfter: options?.retryAfter,
        },
      }
    );
    this.name = "RateLimitError";
    this.platform = platform;
    this.retryAfter = options?.retryAfter;
  }
}

/**
 * Helper to check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof PlatformAPIError) {
    return error.retryable;
  }
  if (error instanceof TokenExpiredError) {
    return true; // Can retry after refresh
  }
  if (error instanceof RateLimitError) {
    return true; // Can retry after delay
  }
  if (error instanceof LLMOutputError) {
    return true; // Can retry with better prompt
  }
  if (error instanceof InvalidInputError) {
    return false; // User error, not retryable
  }
  if (error instanceof MissingDataError) {
    return false; // Data doesn't exist, not retryable
  }
  if (error instanceof PermissionError) {
    return false; // Permission issue, not retryable
  }
  
  // Default: network/system errors are retryable
  return true;
}

/**
 * Helper to get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error, context?: { platform?: string }): string {
  if (error instanceof PlatformAPIError) {
    return `Failed to publish to ${error.platform}. Please try again.`;
  }
  if (error instanceof TokenExpiredError) {
    return `Your ${error.platform} connection expired. Please reconnect in Settings.`;
  }
  if (error instanceof LLMOutputError) {
    return "Failed to generate content. Please try again.";
  }
  if (error instanceof InvalidInputError) {
    return error.message;
  }
  if (error instanceof MissingDataError) {
    return `${error.resourceType} not found. It may have been deleted.`;
  }
  if (error instanceof PermissionError) {
    return "You don't have permission to perform this action.";
  }
  if (error instanceof RateLimitError) {
    return `Rate limit exceeded for ${error.platform}. Please try again later.`;
  }
  
  // Fallback to error message
  return error.message || "An unexpected error occurred. Please try again.";
}

/**
 * Get a safe, short error message for agent responses
 * This should be concise and actionable, suitable for LLM context
 */
export function getAgentSafeErrorMessage(toolResult: { success: boolean; message: string; error?: string }): string {
  if (toolResult.success) {
    return toolResult.message;
  }

  // Map common error codes to short, actionable messages
  const errorCode = toolResult.error || "";
  
  if (errorCode === "NO_ACCOUNT") {
    return "No connected account found. Please connect a social account first in Settings.";
  }
  
  if (errorCode === "INVALID_DATE") {
    return toolResult.message; // Already user-friendly
  }
  
  if (errorCode === "POST_NOT_FOUND") {
    return "Post not found. It may have been deleted.";
  }
  
  if (errorCode === "TOKEN_EXPIRED") {
    return "Social account connection expired. Please reconnect in Settings.";
  }
  
  if (errorCode === "PLATFORM_API_ERROR") {
    return "Platform API error. Please try again in a moment.";
  }
  
  // Fallback to the message, truncated if too long
  const message = toolResult.message || "Operation failed";
  return message.length > 150 ? message.substring(0, 147) + "..." : message;
}

