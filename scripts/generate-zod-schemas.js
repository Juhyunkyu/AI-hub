#!/usr/bin/env node

/**
 * Supabase to Zod Schema Generator
 *
 * This script generates Zod schemas from Supabase TypeScript types
 * using Supazod, ensuring type consistency between database and validation
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

const PROJECT_ROOT = process.cwd();
const TYPES_FILE = join(PROJECT_ROOT, 'src/types/supabase.ts');
const OUTPUT_SCHEMAS = join(PROJECT_ROOT, 'src/lib/schemas/supabase-generated.ts');
const OUTPUT_TYPES = join(PROJECT_ROOT, 'src/lib/schemas/supabase-types.ts');

/**
 * Generate Zod schemas from Supabase types
 */
async function generateZodSchemas() {
  console.log('🔄 Generating Zod schemas from Supabase types...');

  try {
    // Check if input file exists
    if (!existsSync(TYPES_FILE)) {
      console.error(`❌ Input file not found: ${TYPES_FILE}`);
      process.exit(1);
    }

    // Step 1: Generate Zod schemas using Supazod
    console.log('⚡ Generating Zod schemas with Supazod...');

    const supazodCommand = [
      'npx supazod',
      `-i "${TYPES_FILE}"`,
      `-o "${OUTPUT_SCHEMAS}"`,
      `-t "${OUTPUT_TYPES}"`,
      '-s public',
      '--verbose'
    ].join(' ');

    console.log(`Executing: ${supazodCommand}`);
    execSync(supazodCommand, { stdio: 'inherit' });

    // Step 2: Add custom enhancements to generated schemas
    console.log('✨ Enhancing generated schemas...');
    await enhanceGeneratedSchemas();

    // Step 3: Generate custom utilities
    console.log('🛠️ Generating utility functions...');
    await generateUtilities();

    console.log('✅ Schema generation completed successfully!');
    console.log(`📁 Generated files:`);
    console.log(`   - ${OUTPUT_SCHEMAS}`);
    console.log(`   - ${OUTPUT_TYPES}`);
    console.log(`   - src/lib/schemas/utilities.ts`);

  } catch (error) {
    console.error('❌ Error generating schemas:', error.message);
    process.exit(1);
  }
}

/**
 * Enhance the generated schemas with custom validations
 */
async function enhanceGeneratedSchemas() {
  try {
    const schemasContent = readFileSync(OUTPUT_SCHEMAS, 'utf-8');

    const enhancedContent = `${schemasContent}

// ============================================================================
// Custom Enhancements
// ============================================================================

/**
 * Enhanced Profile Schema with custom validations
 */
export const EnhancedProfileSchema = ProfilesRowSchema?.extend ? ProfilesRowSchema.extend({
  username: z.string()
    .min(3, '사용자명은 3글자 이상이어야 합니다')
    .max(50, '사용자명은 50글자 이하여야 합니다')
    .regex(/^[a-zA-Z0-9_-]+$/, '사용자명은 영문, 숫자, 언더스코어, 하이픈만 사용 가능합니다')
    .nullable(),
  bio: z.string()
    .max(500, '자기소개는 500글자 이하여야 합니다')
    .nullable(),
}) : z.object({
  id: z.string(),
  username: z.string().nullable(),
  bio: z.string().nullable(),
});

/**
 * Enhanced Post Schema with content validation
 */
export const EnhancedPostSchema = PostsRowSchema?.extend ? PostsRowSchema.extend({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200글자 이하여야 합니다'),
  content: z.string()
    .max(10000, '내용은 10,000글자 이하여야 합니다')
    .nullable(),
  url: z.string().url('유효하지 않은 URL 형식입니다').nullable().optional(),
}) : z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
});

/**
 * Enhanced Comment Schema with body validation
 */
export const EnhancedCommentSchema = CommentsRowSchema?.extend ? CommentsRowSchema.extend({
  body: z.string()
    .min(1, '댓글 내용은 필수입니다')
    .max(2000, '댓글은 2,000글자 이하여야 합니다'),
}) : z.object({
  id: z.string(),
  body: z.string(),
});

/**
 * Query Parameter Schemas
 */
export const PostQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  category: z.string().optional(),
  author: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  orderBy: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type EnhancedProfile = z.infer<typeof EnhancedProfileSchema>;
export type EnhancedPost = z.infer<typeof EnhancedPostSchema>;
export type EnhancedComment = z.infer<typeof EnhancedCommentSchema>;

export type PostQuery = z.infer<typeof PostQuerySchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
`;

    writeFileSync(OUTPUT_SCHEMAS, enhancedContent);
  } catch (error) {
    console.error('Error enhancing schemas:', error.message);
  }
}

/**
 * Generate utility functions for schema validation
 */
async function generateUtilities() {
  const utilitiesContent = `/**
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
      return path ? \`\${path}: \${issue.message}\` : issue.message;
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
`;

  const utilitiesPath = join(PROJECT_ROOT, 'src/lib/schemas/utilities.ts');
  writeFileSync(utilitiesPath, utilitiesContent);
}

// Run the script
if (require.main === module) {
  generateZodSchemas();
}

module.exports = { generateZodSchemas };