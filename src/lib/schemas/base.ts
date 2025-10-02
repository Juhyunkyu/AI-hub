/**
 * Base Schemas - Fundamental validation schemas
 *
 * This file contains primitive schema definitions that are used across
 * the entire application. By separating these base schemas, we avoid
 * circular dependencies and maintain a clean dependency hierarchy:
 *
 * base.ts → domain schemas (chat, post, etc.) → index.ts
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * UUID Schema - validates UUID v4 format
 */
export const UUIDSchema = z.string().uuid('유효하지 않은 UUID 형식입니다');

/**
 * Email Schema - validates email format
 */
export const EmailSchema = z.string().email('유효하지 않은 이메일 형식입니다');

/**
 * URL Schema - validates URL format
 */
export const URLSchema = z.string().url('유효하지 않은 URL 형식입니다').optional();

/**
 * Timestamp Schema - validates ISO 8601 datetime
 */
export const TimestampSchema = z.string().datetime('유효하지 않은 날짜 형식입니다');

/**
 * JSON Schema - validates any valid JSON value
 */
const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(JsonSchema), z.record(JsonSchema)])
);
