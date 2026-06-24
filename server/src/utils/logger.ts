/**
 * Logger utility for consistent logging across the application
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
  source?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private formatTime(): string {
    return new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  private formatMessage(level: LogLevel, message: string, options?: LogOptions): string {
    const time = this.formatTime();
    const source = options?.source || "app";
    const metadata = options?.metadata ? ` ${JSON.stringify(options.metadata)}` : "";
    return `${time} [${source}] [${level.toUpperCase()}] ${message}${metadata}`;
  }

  info(message: string, options?: LogOptions): void {
    console.log(this.formatMessage('info', message, options));
  }

  warn(message: string, options?: LogOptions): void {
    console.warn(this.formatMessage('warn', message, options));
  }

  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const metadata = {
      ...options?.metadata,
      error: errorMessage,
      ...(stack && { stack }),
    };
    console.error(this.formatMessage('error', message, { ...options, metadata }));
  }

  debug(message: string, options?: LogOptions): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, options));
    }
  }
}

export const logger = new Logger();
export default logger;
