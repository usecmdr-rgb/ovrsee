/**
 * Structured Logging Utility
 * 
 * Provides consistent logging format for API requests, errors, and events
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  orgId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In production, send to logging service (Logtail, Datadog, etc.)
    if (process.env.LOGTAIL_SOURCE_TOKEN) {
      // TODO: Send to Logtail
      // fetch('https://in.logtail.com', { ... })
    }

    // Console output with structured format
    const consoleMethod = level === "error" ? console.error : console.log;
    consoleMethod(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === "development") {
      this.log("debug", message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    };
    this.log("error", error instanceof Error ? error.message : String(error), errorContext);
  }

  /**
   * Log API request
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ) {
    this.info(`${method} ${path} ${statusCode}`, {
      ...context,
      method,
      path,
      statusCode,
      durationMs: duration,
    });
  }
}

export const logger = new Logger();



