import { getContext } from "./telemetry";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogPayload {
  message: string;
  module?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: any;
}

class StructuredLogger {
  private log(level: LogLevel, payload: LogPayload | string): void {
    const context = getContext();
    const timestamp = new Date().toISOString();

    let logObj: Record<string, any> = {
      timestamp,
      level,
      traceId: context?.traceId,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.userId,
      username: context?.username,
      spanId: context?.spanId,
    };

    if (typeof payload === "string") {
      logObj.message = payload;
    } else {
      logObj.message = payload.message;
      if (payload.module) logObj.module = payload.module;
      if (payload.action) logObj.action = payload.action;
      if (payload.duration !== undefined) logObj.duration = payload.duration;
      if (payload.metadata) logObj.metadata = payload.metadata;
      if (payload.error) {
        logObj.error = payload.error instanceof Error ? {
          message: payload.error.message,
          stack: payload.error.stack,
        } : payload.error;
      }
    }

    const output = JSON.stringify(logObj);
    if (level === "ERROR") {
      console.error(output);
    } else if (level === "WARN") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  info(payload: LogPayload | string): void {
    this.log("INFO", payload);
  }

  warn(payload: LogPayload | string): void {
    this.log("WARN", payload);
  }

  error(payload: LogPayload | string): void {
    this.log("ERROR", payload);
  }

  debug(payload: LogPayload | string): void {
    if (process.env.NODE_ENV === "development") {
      this.log("DEBUG", payload);
    }
  }
}

export const logger = new StructuredLogger();
export default logger;
