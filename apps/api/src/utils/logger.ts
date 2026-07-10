/**
 * Logger utility for consistent structured logging across the application.
 */

import { getContext } from "../core/telemetry/telemetry";

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogOptions {
  source?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

class Logger {
  private logStructured(level: LogLevel, message: string, options?: LogOptions, error?: Error | unknown): void {
    const context = getContext();
    const timestamp = new Date().toISOString();
    const source = options?.source || "app";

    const errMessage = error ? (error instanceof Error ? error.message : String(error)) : undefined;
    const errStack = error instanceof Error ? error.stack : undefined;

    const payload = {
      timestamp,
      level,
      traceId: context.traceId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      userId: context.userId,
      username: context.username,
      source,
      message,
      metadata: options?.metadata || undefined,
      ...(errMessage && { error: errMessage }),
      ...(errStack && { stack: errStack }),
    };

    if (level === 'ERROR') {
      console.error(JSON.stringify(payload));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(payload));
    } else if (level === 'DEBUG') {
      if (process.env.NODE_ENV === 'development') {
        console.debug(JSON.stringify(payload));
      }
    } else {
      console.log(JSON.stringify(payload));
    }
  }

  info(message: string, options?: LogOptions): void {
    this.logStructured('INFO', message, options);
  }

  warn(message: string, options?: LogOptions): void {
    this.logStructured('WARN', message, options);
  }

  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    this.logStructured('ERROR', message, options, error);
  }

  debug(message: string, options?: LogOptions): void {
    this.logStructured('DEBUG', message, options);
  }
}

export const logger = new Logger();
export default logger;
