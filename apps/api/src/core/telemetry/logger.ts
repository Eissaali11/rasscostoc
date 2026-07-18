/**
 * Canonical Structured Logger — ERP-008 Phase 8-A
 *
 * Every log entry emitted by this logger carries a fixed set of fields
 * required for production observability:
 *   timestamp · level · service · environment
 *   traceId · correlationId · requestId · userId · username · spanId
 *   module · action · duration · metadata · error
 *
 * NEVER log: passwords, tokens, cookies, API keys, connection strings,
 * or any PII beyond userId/username that is already present in the request
 * session.
 */

import { getContext } from "./telemetry";

const SERVICE_NAME = "stockpro-api";
const ENVIRONMENT = process.env.NODE_ENV ?? "development";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogPayload {
  message: string;
  module?: string;
  action?: string;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

class StructuredLogger {
  private log(level: LogLevel, payload: LogPayload | string): void {
    const context = getContext();
    const timestamp = new Date().toISOString();

    const logObj: Record<string, unknown> = {
      timestamp,
      level,
      service: SERVICE_NAME,
      environment: ENVIRONMENT,
      traceId: context?.traceId,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.userId,
      username: context?.username,
      spanId: context?.spanId,
    };

    if (typeof payload === "string") {
      logObj["message"] = payload;
    } else {
      logObj["message"] = payload.message;
      if (payload.module) logObj["module"] = payload.module;
      if (payload.action) logObj["action"] = payload.action;
      if (payload.duration !== undefined) logObj["duration"] = payload.duration;
      if (payload.statusCode !== undefined) logObj["statusCode"] = payload.statusCode;
      if (payload.errorCode) logObj["errorCode"] = payload.errorCode;
      if (payload.metadata) logObj["metadata"] = payload.metadata;
      if (payload.error) {
        logObj["error"] =
          payload.error instanceof Error
            ? { message: payload.error.message, stack: payload.error.stack }
            : String(payload.error);
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
    if (ENVIRONMENT === "development") {
      this.log("DEBUG", payload);
    }
  }
}

export const logger = new StructuredLogger();
export default logger;
