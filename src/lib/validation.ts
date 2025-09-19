/**
 * 통합 검증 유틸리티
 * Zod 스키마를 활용한 런타임 검증과 타입 안전성 제공
 */

import { z } from 'zod';
import {
  PostSchema,
  CreatePostSchema,
  UpdatePostSchema,
  ProfileSchema,
  CreateProfileSchema,
  UpdateProfileSchema,
  MessageSchema,
  CreateMessageSchema,
  UpdateMessageSchema,
  CommentSchema,
  CreateCommentSchema,
  UpdateCommentSchema,
  ReactionSchema,
  CreateReactionSchema,
  FollowSchema,
  PostFilterSchema,
  UserFilterSchema,
  PaginationSchema,
  SortSchema,
  type Post,
  type CreatePost,
  type UpdatePost,
  type Profile,
  type CreateProfile,
  type UpdateProfile,
  type Message,
  type CreateMessage,
  type UpdateMessage,
  type Comment,
  type CreateComment,
  type UpdateComment,
  type Reaction,
  type CreateReaction,
  type Follow,
  type PostFilter,
  type UserFilter,
  type Pagination,
  type Sort
} from '@/lib/schemas';

// ============================================================================
// 검증 결과 타입
// ============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export interface ValidationFailure {
  success: false;
  data: null;
  error: {
    message: string;
    issues: z.ZodIssue[];
  };
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ============================================================================
// 기본 검증 함수
// ============================================================================

/**
 * 제네릭 검증 함수
 */
export function validate<T>(
  data: unknown,
  schema: z.ZodType<T>
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return {
      success: true,
      data: result,
      error: null
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        error: {
          message: error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
          issues: error.issues
        }
      };
    }

    return {
      success: false,
      data: null,
      error: {
        message: error instanceof Error ? error.message : '알 수 없는 검증 오류',
        issues: []
      }
    };
  }
}

/**
 * 안전한 검증 함수 (에러를 던지지 않음)
 */
export function safeValidate<T>(
  data: unknown,
  schema: z.ZodType<T>
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      error: null
    };
  }

  return {
    success: false,
    data: null,
    error: {
      message: result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', '),
      issues: result.error.issues
    }
  };
}

// ============================================================================
// 엔티티별 검증 함수들
// ============================================================================

/**
 * 게시물 검증 함수들
 */
export const validatePost = {
  entity: (data: unknown): ValidationResult<Post> => validate(data, PostSchema),
  create: (data: unknown): ValidationResult<CreatePost> => validate(data, CreatePostSchema),
  update: (data: unknown): ValidationResult<UpdatePost> => validate(data, UpdatePostSchema),
  filter: (data: unknown): ValidationResult<PostFilter> => validate(data, PostFilterSchema),
};

/**
 * 사용자 프로필 검증 함수들
 */
export const validateProfile = {
  entity: (data: unknown): ValidationResult<Profile> => validate(data, ProfileSchema),
  create: (data: unknown): ValidationResult<CreateProfile> => validate(data, CreateProfileSchema),
  update: (data: unknown): ValidationResult<UpdateProfile> => validate(data, UpdateProfileSchema),
  filter: (data: unknown): ValidationResult<UserFilter> => validate(data, UserFilterSchema),
};

/**
 * 메시지 검증 함수들
 */
export const validateMessage = {
  entity: (data: unknown): ValidationResult<Message> => validate(data, MessageSchema),
  create: (data: unknown): ValidationResult<CreateMessage> => validate(data, CreateMessageSchema),
  update: (data: unknown): ValidationResult<UpdateMessage> => validate(data, UpdateMessageSchema),
};

/**
 * 댓글 검증 함수들
 */
export const validateComment = {
  entity: (data: unknown): ValidationResult<Comment> => validate(data, CommentSchema),
  create: (data: unknown): ValidationResult<CreateComment> => validate(data, CreateCommentSchema),
  update: (data: unknown): ValidationResult<UpdateComment> => validate(data, UpdateCommentSchema),
};

/**
 * 반응 검증 함수들
 */
export const validateReaction = {
  entity: (data: unknown): ValidationResult<Reaction> => validate(data, ReactionSchema),
  create: (data: unknown): ValidationResult<CreateReaction> => validate(data, CreateReactionSchema),
};

/**
 * 팔로우 검증 함수들
 */
export const validateFollow = {
  entity: (data: unknown): ValidationResult<Follow> => validate(data, FollowSchema),
};

/**
 * 공통 검증 함수들
 */
export const validateCommon = {
  pagination: (data: unknown): ValidationResult<Pagination> => validate(data, PaginationSchema),
  sort: (data: unknown): ValidationResult<Sort> => validate(data, SortSchema),
};

// ============================================================================
// 유틸리티 함수들
// ============================================================================

/**
 * UUID 검증
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * 이메일 검증
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * URL 검증
 */
export function isValidURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 사용자명 검증 (한국어 포함)
 */
export function isValidUsername(value: string): boolean {
  // 3-50자, 영문/숫자/한글/언더스코어/하이픈
  const usernameRegex = /^[a-zA-Z0-9가-힣_-]{3,50}$/;
  return usernameRegex.test(value);
}

/**
 * 비밀번호 강도 검증
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('최소 8자 이상이어야 합니다');
  }

  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('소문자를 포함해야 합니다');
  }

  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('대문자를 포함해야 합니다');
  }

  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('숫자를 포함해야 합니다');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('특수문자를 포함해야 합니다');
  }

  return {
    isValid: score >= 3,
    score,
    feedback
  };
}

/**
 * 파일 크기 검증 (바이트 단위)
 */
export function isValidFileSize(size: number, maxSize: number = 5 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * 이미지 파일 타입 검증
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * 안전한 HTML 내용 검증 (기본적인 XSS 방지)
 */
export function isSafeHTML(content: string): boolean {
  // 위험한 태그들 검사
  const dangerousTags = /<script|<iframe|<object|<embed|<form/i;

  // 위험한 속성들 검사
  const dangerousAttrs = /on\w+\s*=/i;

  return !dangerousTags.test(content) && !dangerousAttrs.test(content);
}

/**
 * 페이지네이션 파라미터 정규화
 */
export function normalizePagination(params: Partial<Pagination>): Pagination {
  return {
    page: Math.max(1, params.page || 1),
    limit: Math.min(100, Math.max(1, params.limit || 10))
  };
}

/**
 * 정렬 파라미터 정규화
 */
export function normalizeSort(params: Partial<Sort>): Sort {
  return {
    orderBy: params.orderBy || 'created_at',
    order: params.order === 'asc' ? 'asc' : 'desc'
  };
}

// ============================================================================
// 고급 검증 함수들
// ============================================================================

/**
 * 조건부 검증 (필드가 존재할 때만 검증)
 */
export function validateConditional<T>(
  data: unknown,
  schema: z.ZodType<T>,
  condition: (data: unknown) => boolean
): ValidationResult<T | null> {
  if (!condition(data)) {
    return {
      success: true,
      data: null,
      error: null
    };
  }

  return validate(data, schema);
}

/**
 * 배열 요소별 검증
 */
export function validateArray<T>(
  data: unknown[],
  schema: z.ZodType<T>
): ValidationResult<T[]> {
  if (!Array.isArray(data)) {
    return {
      success: false,
      data: null,
      error: {
        message: '배열이 아닙니다',
        issues: []
      }
    };
  }

  const results: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = safeValidate(data[i], schema);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(`인덱스 ${i}: ${result.error.message}`);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      data: null,
      error: {
        message: errors.join(', '),
        issues: []
      }
    };
  }

  return {
    success: true,
    data: results,
    error: null
  };
}

/**
 * 부분 업데이트 검증 (일부 필드만 있어도 OK)
 */
export function validatePartialUpdate<T extends Record<string, unknown>>(
  data: unknown,
  schema: z.ZodObject<z.ZodRawShape>
): ValidationResult<Partial<T>> {
  if (typeof data !== 'object' || data === null) {
    return {
      success: false,
      data: null,
      error: {
        message: '객체가 아닙니다',
        issues: []
      }
    };
  }

  // 부분 스키마로 변환
  const partialSchema = schema.partial();
  return validate(data, partialSchema) as ValidationResult<Partial<T>>;
}

// ============================================================================
// 개발용 헬퍼 함수들
// ============================================================================

/**
 * 검증 오류를 콘솔에 친화적으로 출력
 */
export function logValidationError(error: ValidationFailure['error']): void {
  console.group('🚨 Validation Error');
  console.log('Message:', error.message);

  if (error.issues.length > 0) {
    console.log('Issues:');
    error.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  console.groupEnd();
}

/**
 * 스키마로부터 TypeScript 타입 정보를 추출 (개발용)
 */
export function getSchemaInfo(schema: z.ZodTypeAny): {
  typeName: string;
  description?: string;
  isOptional: boolean;
  isNullable: boolean;
} {
  return {
    typeName: (schema._def as { typeName?: string }).typeName || 'unknown',
    description: schema.description,
    isOptional: schema.isOptional(),
    isNullable: schema.isNullable()
  };
}