/**
 * Zod Schema Validation Test API Route
 *
 * This endpoint demonstrates the new Supazod-based validation system
 * Usage: POST /api/validation-test with various payloads to test validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  publicPostsInsertSchema,
  publicProfilesUpdateSchema,
  EnhancedPostSchema,
  EnhancedProfileSchema,
  PostQuerySchema,
  UserQuerySchema
} from '@/lib/schemas/supabase-generated';
import {
  validateRequestBody,
  validateSearchParams,
  createApiResponse,
  createValidationError,
  ValidationSchemaError
} from '@/lib/schemas/utilities';

// Test schema for demonstration
const TestPayloadSchema = z.object({
  test_type: z.enum(['post', 'profile', 'query']),
  data: z.unknown(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse the test payload
    const result = await validateRequestBody(request, TestPayloadSchema);

    if (!result.success) {
      return NextResponse.json(
        createValidationError(result.error.issues),
        { status: 400 }
      );
    }

    const { test_type, data } = result.data;

    let validationResult;
    let schemaUsed = '';

    // Test different schemas based on test_type
    switch (test_type) {
      case 'post':
        // Test enhanced post schema
        schemaUsed = 'EnhancedPostSchema';
        validationResult = EnhancedPostSchema.safeParse(data);
        break;

      case 'profile':
        // Test enhanced profile schema
        schemaUsed = 'EnhancedProfileSchema';
        validationResult = EnhancedProfileSchema.safeParse(data);
        break;

      case 'query':
        // Test query parameter schema
        schemaUsed = 'PostQuerySchema';
        validationResult = PostQuerySchema.safeParse(data);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid test_type' },
          { status: 400 }
        );
    }

    // Return validation results
    if (validationResult.success) {
      return NextResponse.json(createApiResponse({
        schema_used: schemaUsed,
        validation_status: 'success',
        validated_data: validationResult.data,
        message: 'Validation passed successfully!'
      }));
    } else {
      return NextResponse.json({
        schema_used: schemaUsed,
        validation_status: 'failed',
        error: {
          message: 'Validation failed',
          issues: validationResult.error.issues,
          formatted_errors: validationResult.error.issues.map(issue => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          })
        }
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Validation test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    // Test query parameter validation
    const result = validateSearchParams(searchParams, PostQuerySchema);

    if (!result.success) {
      return NextResponse.json(
        createValidationError(result.error.issues),
        { status: 400 }
      );
    }

    return NextResponse.json(createApiResponse({
      message: 'Query parameter validation test passed!',
      validated_params: result.data,
      original_params: Object.fromEntries(searchParams.entries()),
    }));

  } catch (error) {
    console.error('Query validation test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}