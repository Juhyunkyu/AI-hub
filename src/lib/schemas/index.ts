/**
 * Schemas Index - Central export point for all validation schemas
 *
 * Combines legacy schemas with new Supazod-generated schemas
 * Re-exports all Zod schemas and utilities for easy import throughout the application
 */

import { z } from 'zod';

// ============================================================================
// Supazod Generated Schemas (NEW)
// ============================================================================

// Import base schemas for use in this file
import { UUIDSchema, URLSchema, TimestampSchema, JsonSchema } from './base';

// Re-export all generated schemas and utilities
export * from './base';
export * from './supabase-generated';
export * from './supabase-types';
export * from './utilities';
export * from './chat-schemas';

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * User Role Schema
 */
export const UserRoleSchema = z.enum(['user', 'moderator', 'admin']);

/**
 * Post Type Schema
 */
export const PostTypeSchema = z.enum(['link', 'text', 'image']);

/**
 * Post Status Schema
 */
export const PostStatusSchema = z.enum(['draft', 'published', 'archived', 'deleted']);

/**
 * Message Status Schema
 */
export const MessageStatusSchema = z.enum(['sent', 'delivered', 'read']);

/**
 * Reaction Type Schema
 */
export const ReactionTypeSchema = z.enum(['like', 'love', 'dislike', 'save']);

// ============================================================================
// Core Entity Schemas
// ============================================================================

/**
 * User Profile Schema
 */
export const ProfileSchema = z.object({
  id: UUIDSchema,
  username: z.string()
    .min(3, '사용자명은 3글자 이상이어야 합니다')
    .max(50, '사용자명은 50글자 이하여야 합니다')
    .regex(/^[a-zA-Z0-9_-]+$/, '사용자명은 영문, 숫자, 언더스코어, 하이픈만 사용 가능합니다')
    .nullable(),
  bio: z.string()
    .max(500, '자기소개는 500글자 이하여야 합니다')
    .nullable(),
  avatar_url: URLSchema.nullable(),
  role: UserRoleSchema,
  follower_count: z.number().int().min(0).default(0),
  following_count: z.number().int().min(0).default(0),
  links: JsonSchema.nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Post Schema
 */
export const PostSchema = z.object({
  id: UUIDSchema,
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200글자 이하여야 합니다'),
  content: z.string()
    .max(10000, '내용은 10,000글자 이하여야 합니다')
    .nullable(),
  author_id: UUIDSchema,
  post_type: PostTypeSchema,
  status: PostStatusSchema,
  url: URLSchema.nullable(),
  source: z.string().max(100).nullable(),
  thumbnail: URLSchema.nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Comment Schema
 */
export const CommentSchema = z.object({
  id: UUIDSchema,
  body: z.string()
    .min(1, '댓글 내용은 필수입니다')
    .max(2000, '댓글은 2,000글자 이하여야 합니다'),
  author_id: UUIDSchema,
  post_id: UUIDSchema,
  parent_id: UUIDSchema.nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Message Schema
 */
export const MessageSchema = z.object({
  id: UUIDSchema,
  from_user_id: UUIDSchema,
  to_user_id: UUIDSchema,
  subject: z.string()
    .max(100, '제목은 100글자 이하여야 합니다')
    .nullable(),
  content: z.string()
    .min(1, '메시지 내용은 필수입니다')
    .max(5000, '메시지는 5,000글자 이하여야 합니다'),
  read: z.boolean().default(false),
  status: MessageStatusSchema.default('sent'),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Reaction Schema
 */
export const ReactionSchema = z.object({
  id: UUIDSchema,
  target_type: z.enum(['post', 'comment']),
  target_id: UUIDSchema,
  user_id: UUIDSchema,
  type: ReactionTypeSchema,
  created_at: TimestampSchema,
});

/**
 * Follow Schema
 */
export const FollowSchema = z.object({
  id: UUIDSchema,
  follower_id: UUIDSchema,
  following_id: UUIDSchema,
  created_at: TimestampSchema,
});

// ============================================================================
// Input/Create Schemas (for inserts)
// ============================================================================

/**
 * Profile Creation Schema
 */
export const CreateProfileSchema = ProfileSchema.omit({
  created_at: true,
  updated_at: true,
  follower_count: true,
  following_count: true,
}).extend({
  id: UUIDSchema.optional(), // Allow optional for auto-generation
});

/**
 * Post Creation Schema
 */
export const CreatePostSchema = PostSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  status: PostStatusSchema.default('draft'),
});

/**
 * Comment Creation Schema
 */
export const CreateCommentSchema = CommentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

/**
 * Message Creation Schema
 */
export const CreateMessageSchema = MessageSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  read: true,
  status: true,
});

/**
 * Reaction Creation Schema
 */
export const CreateReactionSchema = ReactionSchema.omit({
  id: true,
  created_at: true,
});

// ============================================================================
// Update Schemas (for updates)
// ============================================================================

/**
 * Profile Update Schema
 */
export const UpdateProfileSchema = CreateProfileSchema.partial().omit({
  id: true,
});

/**
 * Post Update Schema
 */
export const UpdatePostSchema = CreatePostSchema.partial().omit({
  author_id: true,
});

/**
 * Comment Update Schema
 */
export const UpdateCommentSchema = CreateCommentSchema.partial().pick({
  body: true,
});

/**
 * Message Update Schema
 */
export const UpdateMessageSchema = MessageSchema.partial().pick({
  read: true,
  status: true,
});

// ============================================================================
// Query/Filter Schemas
// ============================================================================

/**
 * Pagination Schema
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

/**
 * Sort Schema
 */
export const SortSchema = z.object({
  orderBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Post Filter Schema
 */
export const PostFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: UUIDSchema.optional(),
  status: PostStatusSchema.optional(),
  post_type: PostTypeSchema.optional(),
  dateFrom: TimestampSchema.optional(),
  dateTo: TimestampSchema.optional(),
}).merge(PaginationSchema).merge(SortSchema);

/**
 * User Filter Schema
 */
export const UserFilterSchema = z.object({
  search: z.string().optional(),
  role: UserRoleSchema.optional(),
}).merge(PaginationSchema).merge(SortSchema);

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Generic Paginated Response Schema
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(0),
  });

/**
 * Generic API Response Schema
 */
export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    error: z.null(),
  });

/**
 * API Error Response Schema
 */
export const ApiErrorResponseSchema = z.object({
  data: z.null(),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

// Entity Types
export type Profile = z.infer<typeof ProfileSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;
export type Follow = z.infer<typeof FollowSchema>;

// Input Types
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type CreatePost = z.infer<typeof CreatePostSchema>;
export type CreateComment = z.infer<typeof CreateCommentSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type CreateReaction = z.infer<typeof CreateReactionSchema>;

// Update Types
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type UpdatePost = z.infer<typeof UpdatePostSchema>;
export type UpdateComment = z.infer<typeof UpdateCommentSchema>;
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;

// Filter Types
export type PostFilter = z.infer<typeof PostFilterSchema>;
export type UserFilter = z.infer<typeof UserFilterSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type Sort = z.infer<typeof SortSchema>;

// Response Types
export type PaginatedResponse<T> = z.infer<ReturnType<typeof createPaginatedResponseSchema<z.ZodType<T>>>>;
export type ApiResponse<T> = z.infer<ReturnType<typeof createApiResponseSchema<z.ZodType<T>>>>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// Enum Types
export type UserRole = z.infer<typeof UserRoleSchema>;
export type PostType = z.infer<typeof PostTypeSchema>;
export type PostStatus = z.infer<typeof PostStatusSchema>;
export type MessageStatus = z.infer<typeof MessageStatusSchema>;
export type ReactionType = z.infer<typeof ReactionTypeSchema>;