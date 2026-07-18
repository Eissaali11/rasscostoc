/**
 * Global error handling middleware
 */

import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "@core/errors/AppError";
import { logger } from "@server/utils/logger";
import { getContext } from "@core/telemetry/telemetry";

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const context = getContext();
  
  // Log the error
  logger.error("Request error", err, {
    source: "errorHandler",
    metadata: {
      method: req.method,
      path: req.path,
    },
  });

  // Handle known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      traceId: context.traceId,
      ...(err instanceof ValidationError && { errors: (err as any).errors }),
    });
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      message: "Validation error",
      traceId: context.traceId,
      errors: (err as any).errors,
    });
    return;
  }

  // Handle unknown errors
  const statusCode = (err as any).status || (err as any).statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? "Internal server error" : message,
    traceId: context.traceId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
