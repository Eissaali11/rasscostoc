/**
 * String-style logging facade.
 *
 * Delegates to the canonical structured logger (core/telemetry/logger) so the
 * application has a SINGLE structured-logging implementation. This adapter only
 * exists to preserve the ergonomic `logger.info("msg", { source, metadata })`
 * call style used across several modules; it no longer emits its own JSON.
 */

import { logger as structuredLogger } from "../core/telemetry/logger";

interface LogOptions {
  source?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

class Logger {
  info(message: string, options?: LogOptions): void {
    structuredLogger.info({ message, module: options?.source, metadata: options?.metadata });
  }

  warn(message: string, options?: LogOptions): void {
    structuredLogger.warn({ message, module: options?.source, metadata: options?.metadata });
  }

  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    structuredLogger.error({ message, module: options?.source, metadata: options?.metadata, error });
  }

  debug(message: string, options?: LogOptions): void {
    structuredLogger.debug({ message, module: options?.source, metadata: options?.metadata });
  }
}

export const logger = new Logger();
export default logger;
