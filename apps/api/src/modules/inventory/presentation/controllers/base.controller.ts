import type { Request, Response } from "express";
import { z } from "zod";

/**
 * Base Controller - Foundation for all domain controllers
 * Following Clean Architecture principles with standardized error handling
 */
export abstract class BaseController {
  /**
   * Handle HTTP errors with consistent format
   */
  protected handleError(res: Response, error: unknown, defaultMessage: string = "Operation failed"): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: "Invalid data", 
        errors: error.errors 
      });
      return;
    }
    
    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message.includes("not found")) {
        res.status(404).json({ message: "Resource not found" });
        return;
      }
      
      if (error.message.includes("already exists")) {
        res.status(409).json({ message: "Resource already exists" });
        return;
      }
    }
    
    console.error("Controller Error:", error);
    res.status(500).json({ message: defaultMessage });
  }

  /**
   * Handle success response with optional data
   */
  protected handleSuccess(res: Response, data?: any, status: number = 200): void {
    if (data !== undefined) {
      res.status(status).json(data);
    } else {
      res.status(status).json({});
    }
  }

  /**
   * Get authenticated user ID from request
   */
  protected getUserId(req: Request): string {
    return (req as any).user?.id;
  }

  /**
   * Get authenticated user object from request
   */
  protected getUser(req: Request): any {
    return (req as any).user;
  }
}