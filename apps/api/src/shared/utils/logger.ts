/**
 * Centralized Logging Utility
 * Delegated to the structured logger to ensure 100% consistency across the application.
 */

import { logger as centralLogger } from "../../utils/logger";

class Logger {
  info(message: string, ...args: any[]): void {
    centralLogger.info(message, args.length > 0 ? { metadata: { args } } : undefined);
  }

  warn(message: string, ...args: any[]): void {
    centralLogger.warn(message, args.length > 0 ? { metadata: { args } } : undefined);
  }

  error(message: string, ...args: any[]): void {
    const lastArg = args[args.length - 1];
    const error = lastArg instanceof Error ? lastArg : undefined;
    const remainingArgs = error ? args.slice(0, -1) : args;

    centralLogger.error(
      message,
      error,
      remainingArgs.length > 0 ? { metadata: { args: remainingArgs } } : undefined
    );
  }

  debug(message: string, ...args: any[]): void {
    centralLogger.debug(message, args.length > 0 ? { metadata: { args } } : undefined);
  }
}

export const logger = new Logger();

/**
 * Legacy compatibility function
 * Maintains compatibility with existing code
 */
export function log(message: string, ...args: any[]): void {
  logger.info(message, ...args);
}