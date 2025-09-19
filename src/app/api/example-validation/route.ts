/**
 * Complete Example: Enhanced Zod Validation with Supazod
 *
 * This API route demonstrates all the features of our new validation system:
 * - Supazod-generated schemas for type safety
 * - Enhanced validation with custom rules
 * - Comprehensive error handling
 * - Utility functions for common patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  // Generated schemas
  publicPostsInsertSchema,
  publicProfilesUpdateSchema,
  EnhancedPostSchema,
  EnhancedProfileSchema,
  PostQuerySchema,

  // Type exports
  type PostQuery,
  type EnhancedPost,
  type EnhancedProfile,
} from '@/lib/schemas/supabase-generated';

import {
  // Validation utilities
  validateRequestBody,
  validateSearchParams,
  createApiResponse,
  createValidationError,
  ValidationSchemaError,
  validateOrThrow,
} from '@/lib/schemas/utilities';

// ============================================================================
// Custom API Schemas
// ============================================================================

const ExampleRequestSchema = z.object({
  action: z.enum(['create_post', 'update_profile', 'search_posts']),
  data: z.unknown(),
});

const CreatePostRequestSchema = publicPostsInsertSchema.extend({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must be 10,000 characters or less')
    .nullable(),
}).omit({
  id: true,
  created_at: true,
  updated_at: true,
  author_id: true, // Will be set from auth
});

// ============================================================================
// API Route Handlers
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Step 1: Validate the main request structure
    const mainValidation = await validateRequestBody(request, ExampleRequestSchema);

    if (!mainValidation.success) {
      return NextResponse.json(
        createValidationError(mainValidation.error.issues),
        { status: 400 }
      );
    }

    const { action, data } = mainValidation.data;

    // Step 2: Route to specific validation based on action
    switch (action) {
      case 'create_post':
        return await handleCreatePost(data);

      case 'update_profile':
        return await handleUpdateProfile(data);

      case 'search_posts':
        return await handleSearchPosts(data);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('API validation example error:', error);

    if (error instanceof ValidationSchemaError) {
      return NextResponse.json(
        createValidationError(error.issues),
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Demonstrate query parameter validation
    const validationResult = validateSearchParams(searchParams, PostQuerySchema);

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationError(validationResult.error.issues),
        { status: 400 }
      );
    }

    const query: PostQuery = validationResult.data;

    return NextResponse.json(createApiResponse({
      message: 'Query validation successful',
      validated_query: query,
      original_params: Object.fromEntries(searchParams.entries()),
      validation_info: {
        page: `Default: 1, Received: ${query.page}`,
        limit: `Default: 10, Received: ${query.limit}`,
        order: `Default: desc, Received: ${query.order}`,
        orderBy: `Default: created_at, Received: ${query.orderBy}`,
      }
    }));

  } catch (error) {
    console.error('GET validation example error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function handleCreatePost(data: unknown) {
  try {
    // Use validateOrThrow for immediate error handling
    const validatedData = validateOrThrow(
      CreatePostRequestSchema,
      data,
      'Invalid post data'
    );

    // Simulate post creation logic
    const newPost: EnhancedPost = {
      ...validatedData,
      id: 'generated-uuid',
      author_id: 'user-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as EnhancedPost;

    return NextResponse.json(createApiResponse({
      message: 'Post would be created successfully',
      post: newPost,
      validation_passed: 'CreatePostRequestSchema + EnhancedPostSchema'
    }));

  } catch (error) {
    if (error instanceof ValidationSchemaError) {
      return NextResponse.json(
        createValidationError(error.issues),
        { status: 400 }
      );
    }
    throw error;
  }
}

async function handleUpdateProfile(data: unknown) {
  // Demonstrate enhanced profile validation
  const result = EnhancedProfileSchema.partial().safeParse(data);

  if (!result.success) {
    return NextResponse.json(
      createValidationError(result.error.issues),
      { status: 400 }
    );
  }

  const profileUpdate: Partial<EnhancedProfile> = result.data;

  return NextResponse.json(createApiResponse({
    message: 'Profile would be updated successfully',
    updates: profileUpdate,
    validation_passed: 'EnhancedProfileSchema.partial()'
  }));
}

async function handleSearchPosts(data: unknown) {
  const result = PostQuerySchema.safeParse(data);

  if (!result.success) {
    return NextResponse.json(
      createValidationError(result.error.issues),
      { status: 400 }
    );
  }

  const searchQuery: PostQuery = result.data;

  return NextResponse.json(createApiResponse({
    message: 'Search would be executed successfully',
    query: searchQuery,
    validation_passed: 'PostQuerySchema',
    applied_defaults: {
      page: searchQuery.page === 1 ? 'Applied default' : 'User provided',
      limit: searchQuery.limit === 10 ? 'Applied default' : 'User provided',
      order: searchQuery.order === 'desc' ? 'Applied default' : 'User provided',
      orderBy: searchQuery.orderBy === 'created_at' ? 'Applied default' : 'User provided',
    }
  }));
}