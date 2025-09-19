/**
 * Schema Validation Utilities
 *
 * Provides helper functions for validating data against Zod schemas
 * with consistent error handling and type safety
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';

// ============================================================================
// Validation Result Types
// ============================================================================

export type ValidationSuccess<T> = {
  success: true;
  data: T;
  error: null;
};

export type ValidationError = {
  success: false;
  data: null;
  error: {
    message: string;
    issues: z.ZodIssue[];
    code: 'VALIDATION_ERROR';
  };
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Safely validate data against a Zod schema
 */
export function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      error: null,
    };
  }

  return {
    success: false,
    data: null,
    error: {
      message: 'Validation failed',
      issues: result.error.issues,
      code: 'VALIDATION_ERROR',
    },
  };
}

/**
 * Validate and throw on error (for use in API routes)
 */
export function validateOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  errorMessage = 'Invalid input data'
): z.infer<T> {
  const result = validateSchema(schema, data);

  if (!result.success) {
    throw new ValidationSchemaError(errorMessage, result.error.issues);
  }

  return result.data;
}

/**
 * Validate Next.js request body
 */
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    return validateSchema(schema, body);
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        message: 'Invalid JSON in request body',
        issues: [],
        code: 'VALIDATION_ERROR',
      },
    };
  }
}

/**
 * Validate URL search parameters
 */
export function validateSearchParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): ValidationResult<z.infer<T>> {
  const params = Object.fromEntries(searchParams.entries());
  return validateSchema(schema, params);
}

// ============================================================================
// Custom Error Classes
// ============================================================================

export class ValidationSchemaError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly code = 'VALIDATION_ERROR';

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationSchemaError';
    this.issues = issues;
  }

  /**
   * Get user-friendly error messages
   */
  getMessages(): string[] {
    return this.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
  }

  /**
   * Get the first error message
   */
  getFirstMessage(): string {
    return this.getMessages()[0] || this.message;
  }
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Create a standardized API success response
 */
export function createApiResponse<T>(data: T) {
  return {
    success: true,
    data,
    error: null,
  };
}

/**
 * Create a standardized API error response
 */
export function createApiError(
  message: string,
  issues?: z.ZodIssue[],
  code = 'API_ERROR'
) {
  return {
    success: false,
    data: null,
    error: {
      message,
      issues: issues || [],
      code,
    },
  };
}

/**
 * Create validation error response for API routes
 */
export function createValidationError(issues: z.ZodIssue[]) {
  return createApiError('Validation failed', issues, 'VALIDATION_ERROR');
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for validation success
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>
): result is ValidationSuccess<T> {
  return result.success;
}

/**
 * Type guard for validation error
 */
export function isValidationError<T>(
  result: ValidationResult<T>
): result is ValidationError {
  return !result.success;
}
