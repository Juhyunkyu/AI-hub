/**
 * React Hook for Client-Side Validation with Zod
 *
 * Provides reusable validation logic for forms and user input
 * with seamless integration with our Supazod-generated schemas
 */

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import type { ValidationResult } from '../schemas/utilities';

// Define ValidationError for internal use
interface ValidationErrorInternal {
  message: string;
  issues: z.ZodIssue[];
  code: 'VALIDATION_ERROR';
}

export interface UseValidationOptions {
  /**
   * Whether to validate on every change (real-time validation)
   */
  validateOnChange?: boolean;

  /**
   * Whether to validate when the hook is first called
   */
  validateOnMount?: boolean;

  /**
   * Custom error messages for specific fields
   */
  customMessages?: Record<string, string>;
}

export interface UseValidationReturn<T> {
  /**
   * Current validation state
   */
  isValid: boolean;

  /**
   * Validation errors (null if valid)
   */
  errors: ValidationErrorInternal | null;

  /**
   * Formatted error messages by field
   */
  fieldErrors: Record<string, string>;

  /**
   * Validated data (null if invalid)
   */
  data: T | null;

  /**
   * Whether validation is currently running
   */
  isValidating: boolean;

  /**
   * Manually trigger validation
   */
  validate: (data: unknown) => Promise<ValidationResult<T>>;

  /**
   * Clear all validation errors
   */
  clearErrors: () => void;

  /**
   * Set custom error for a specific field
   */
  setFieldError: (field: string, message: string) => void;

  /**
   * Get error message for a specific field
   */
  getFieldError: (field: string) => string | undefined;
}

/**
 * Custom hook for Zod schema validation
 */
export function useValidation<T extends z.ZodTypeAny>(
  schema: T,
  options: UseValidationOptions = {}
): UseValidationReturn<z.infer<T>> {
  const {
    validateOnChange = false,
    validateOnMount = false,
    customMessages = {},
  } = options;

  const [state, setState] = useState<{
    isValid: boolean;
    errors: ValidationErrorInternal | null;
    data: z.infer<T> | null;
    isValidating: boolean;
    customFieldErrors: Record<string, string>;
  }>({
    isValid: false,
    errors: null,
    data: null,
    isValidating: false,
    customFieldErrors: {},
  });

  /**
   * Validate data against the schema
   */
  const validate = useCallback(async (data: unknown): Promise<ValidationResult<z.infer<T>>> => {
    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = schema.safeParse(data);

      if (result.success) {
        const successResult: ValidationResult<z.infer<T>> = {
          success: true,
          data: result.data,
          error: null,
        };

        setState(prev => ({
          ...prev,
          isValid: true,
          errors: null,
          data: result.data,
          isValidating: false,
        }));

        return successResult;
      } else {
        const errorResult: ValidationResult<z.infer<T>> = {
          success: false,
          data: null,
          error: {
            message: 'Validation failed',
            issues: result.error.issues,
            code: 'VALIDATION_ERROR',
          },
        };

        setState(prev => ({
          ...prev,
          isValid: false,
          errors: errorResult.error,
          data: null,
          isValidating: false,
        }));

        return errorResult;
      }
    } catch (error) {
      const errorResult: ValidationResult<z.infer<T>> = {
        success: false,
        data: null,
        error: {
          message: 'Validation error occurred',
          issues: [],
          code: 'VALIDATION_ERROR',
        },
      };

      setState(prev => ({
        ...prev,
        isValid: false,
        errors: errorResult.error,
        data: null,
        isValidating: false,
      }));

      return errorResult;
    }
  }, [schema]);

  /**
   * Clear all validation errors
   */
  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: null,
      customFieldErrors: {},
    }));
  }, []);

  /**
   * Set custom error for a specific field
   */
  const setFieldError = useCallback((field: string, message: string) => {
    setState(prev => ({
      ...prev,
      customFieldErrors: {
        ...prev.customFieldErrors,
        [field]: message,
      },
    }));
  }, []);

  /**
   * Get error message for a specific field
   */
  const getFieldError = useCallback((field: string): string | undefined => {
    // Check custom field errors first
    if (state.customFieldErrors[field]) {
      return state.customFieldErrors[field];
    }

    // Check validation errors
    if (state.errors?.issues) {
      const issue = state.errors.issues.find(issue =>
        issue.path.join('.') === field || String(issue.path[issue.path.length - 1]) === field
      );

      if (issue) {
        // Use custom message if available
        const fieldKey = issue.path.join('.');
        return customMessages[fieldKey] || customMessages[field] || issue.message;
      }
    }

    return undefined;
  }, [state.errors, state.customFieldErrors, customMessages]);

  /**
   * Format field errors as a record
   */
  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = { ...state.customFieldErrors };

    if (state.errors?.issues) {
      state.errors.issues.forEach(issue => {
        const fieldPath = issue.path.join('.');
        const fieldName = String(issue.path[issue.path.length - 1]) || 'root';

        if (!errors[fieldPath] && !errors[fieldName]) {
          const customMessage = customMessages[fieldPath] || customMessages[fieldName];
          errors[fieldPath] = customMessage || issue.message;
        }
      });
    }

    return errors;
  }, [state.errors, state.customFieldErrors, customMessages]);

  return {
    isValid: state.isValid,
    errors: state.errors,
    fieldErrors,
    data: state.data,
    isValidating: state.isValidating,
    validate,
    clearErrors,
    setFieldError,
    getFieldError,
  };
}

/**
 * Hook for form validation with automatic field-level validation
 */
export function useFormValidation<T extends z.ZodTypeAny>(
  schema: T,
  options: UseValidationOptions = {}
) {
  const validation = useValidation(schema, options);

  /**
   * Validate a specific field
   */
  const validateField = useCallback(async (fieldName: string, value: unknown) => {
    try {
      // Try to validate just this field using schema.pick if possible
      const fieldSchema = (schema as any).shape?.[fieldName];
      if (fieldSchema) {
        const result = fieldSchema.safeParse(value);
        if (!result.success) {
          validation.setFieldError(fieldName, result.error.issues[0]?.message || 'Invalid value');
        } else {
          // Clear error for this field if validation passes
          validation.setFieldError(fieldName, '');
        }
      }
    } catch (error) {
      // Fallback to full validation
      await validation.validate({ [fieldName]: value });
    }
  }, [schema, validation]);

  return {
    ...validation,
    validateField,
  };
}

/**
 * Utility function to extract error messages for specific form libraries
 */
export function getFormErrors(errors: ValidationErrorInternal | null) {
  if (!errors?.issues) return {};

  return errors.issues.reduce((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {} as Record<string, string>);
}