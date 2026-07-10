type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogOptions {
  source?: string;
  metadata?: Record<string, any>;
}

// Dynamically try to read context from AsyncLocalStorage if active
let RequestContext: any = null;
try {
  // We resolve dynamically to prevent circular dependencies at build-time
  const kernel = require("@stockpro/kernel");
  RequestContext = kernel.RequestContext;
} catch {
  // fallback if not linked
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
    
    // Add contextual tracing IDs if available
    let traceId = "";
    let correlationId = "";
    if (RequestContext) {
      const trace = RequestContext.getTraceId();
      const correlation = RequestContext.getCorrelationId();
      if (trace) traceId = ` traceId=${trace}`;
      if (correlation) correlationId = ` correlationId=${correlation}`;
    }

    const metadata = options?.metadata ? ` ${JSON.stringify(options.metadata)}` : "";
    return `${time} [${source}] [${level.toUpperCase()}]${traceId}${correlationId} ${message}${metadata}`;
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
