/**
 * Validation middleware using Zod schemas
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "@core/errors/AppError";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid request data", error.errors);
      }
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters", error.errors);
      }
      next(error);
    }
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid route parameters", error.errors);
      }
      next(error);
    }
  };
}
