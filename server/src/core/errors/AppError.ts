/**
 * Custom error classes for better error handling
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  public readonly errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict") {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class IdempotencyCollisionError extends AppError {
  constructor(message: string = "Request with this idempotency key is already processed or in progress") {
    super(message, 409);
    this.name = 'IdempotencyCollisionError';
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = "Insufficient stock balance") {
    super(message, 400);
    this.name = 'InsufficientStockError';
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message: string = "Product not found") {
    super(message, 404);
    this.name = 'ProductNotFoundError';
  }
}
