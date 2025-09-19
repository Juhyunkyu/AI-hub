import type { SupabaseClient, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { z } from 'zod';
import type {
  Pagination,
  Sort,
  PaginatedResponse,
  ApiResponse,
  ApiErrorResponse
} from '@/lib/schemas';

/**
 * 기본 Repository 클래스
 * 모든 데이터 접근 계층의 공통 기능을 제공
 *
 * @template TEntity - 엔티티 타입
 * @template TCreate - 생성 입력 타입
 * @template TUpdate - 업데이트 입력 타입
 * @template TFilter - 필터 타입
 */
export abstract class BaseRepository<
  TEntity extends Record<string, any>,
  TCreate extends Record<string, any>,
  TUpdate extends Record<string, any>,
  TFilter extends Record<string, any> = Record<string, any>
> {
  protected supabase = createSupabaseBrowserClient();

  // Abstract properties that must be implemented by subclasses
  protected abstract tableName: string;
  protected abstract entitySchema: z.ZodType<TEntity>;
  protected abstract createSchema: z.ZodType<TCreate>;
  protected abstract updateSchema: z.ZodType<TUpdate>;
  protected abstract filterSchema?: z.ZodType<TFilter>;

  /**
   * 입력 데이터 검증
   */
  protected validateInput<T>(data: unknown, schema: z.ZodType<T>, operation: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new ValidationError(`${operation} 입력 검증 실패: ${messages}`, error.errors);
      }
      throw error;
    }
  }

  /**
   * 응답 데이터 검증
   */
  protected validateResponse<T>(data: unknown, schema: z.ZodType<T>, operation: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`Response validation failed for ${operation}:`, error.errors);
        // 응답 검증 실패는 로그만 남기고 원본 데이터 반환 (운영 환경에서)
        return data as T;
      }
      throw error;
    }
  }

  /**
   * 에러 처리 헬퍼 메서드
   */
  protected handleError(error: unknown, operation: string): never {
    console.error(`Repository Error [${operation}]:`, error);

    // 커스텀 에러 타입 처리
    if (error instanceof ValidationError) {
      throw error;
    }

    // Supabase 에러 타입에 따른 처리
    if (error?.code === 'PGRST116') {
      throw new NotFoundError('데이터를 찾을 수 없습니다');
    }

    if (error?.code === '23505') {
      throw new ConflictError('이미 존재하는 데이터입니다');
    }

    if (error?.code === '42501') {
      throw new ForbiddenError('접근 권한이 없습니다');
    }

    if (error?.code === '23503') {
      throw new ConflictError('참조 무결성 제약 조건 위반');
    }

    // 기본 에러 메시지
    throw new RepositoryError(error?.message || `${operation} 중 오류가 발생했습니다`);
  }

  /**
   * 페이지네이션 헬퍼
   */
  protected getPaginationParams(pagination: Pagination) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    return { from, to, limit, page };
  }

  /**
   * 정렬 헬퍼
   */
  protected buildOrderBy(sort: Sort): { column: string; ascending: boolean } | null {
    const { orderBy, order } = sort;
    if (!orderBy) return null;

    return {
      column: orderBy,
      ascending: order === 'asc'
    };
  }

  /**
   * 필터 적용 헬퍼
   */
  protected applyFilters(
    query: PostgrestFilterBuilder<any, any, any[], any>,
    filters: TFilter
  ): PostgrestFilterBuilder<any, any, any[], any> {
    // 서브클래스에서 구현할 추상 메서드 호출
    return this.buildFilters(query, filters);
  }

  /**
   * 서브클래스에서 구현해야 하는 필터 빌더
   */
  protected abstract buildFilters(
    query: PostgrestFilterBuilder<any, any, any[], any>,
    filters: TFilter
  ): PostgrestFilterBuilder<any, any, any[], any>;

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * ID로 단일 엔티티 조회
   */
  async findById(id: string): Promise<ApiResponse<TEntity | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        this.handleError(error, 'findById');
      }

      const validatedData = data ? this.validateResponse(data, this.entitySchema, 'findById') : null;
      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * 모든 엔티티 조회 (페이지네이션 지원)
   */
  async findAll(
    filters?: TFilter,
    pagination?: Pagination,
    sort?: Sort
  ): Promise<ApiResponse<PaginatedResponse<TEntity>>> {
    try {
      // 기본값 설정
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 9, limit: 10, page: 1 };
      const sortParams = sort ? this.buildOrderBy(sort) : null;

      // 기본 쿼리 구성
      let query = this.supabase.from(this.tableName).select('*', { count: 'exact' });

      // 필터 적용
      if (filters && this.filterSchema) {
        const validatedFilters = this.validateInput(filters, this.filterSchema, 'findAll filters');
        query = this.applyFilters(query, validatedFilters);
      }

      // 정렬 적용
      if (sortParams) {
        query = query.order(sortParams.column, { ascending: sortParams.ascending });
      }

      // 페이지네이션 적용
      query = query.range(paginationParams.from, paginationParams.to);

      const { data, error, count } = await query;

      if (error) {
        this.handleError(error, 'findAll');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, this.entitySchema, 'findAll item')
      ) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData,
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'findAll');
    }
  }

  /**
   * 새 엔티티 생성
   */
  async create(input: TCreate): Promise<ApiResponse<TEntity>> {
    try {
      const validatedInput = this.validateInput(input, this.createSchema, 'create');

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(validatedInput)
        .select()
        .single();

      if (error) {
        this.handleError(error, 'create');
      }

      const validatedData = this.validateResponse(data, this.entitySchema, 'create');
      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * 엔티티 업데이트
   */
  async update(id: string, input: TUpdate): Promise<ApiResponse<TEntity>> {
    try {
      const validatedInput = this.validateInput(input, this.updateSchema, 'update');

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({ ...validatedInput, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.handleError(error, 'update');
      }

      const validatedData = this.validateResponse(data, this.entitySchema, 'update');
      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * 엔티티 삭제
   */
  async delete(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        this.handleError(error, 'delete');
      }

      return { data: { success: true }, error: null };
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * 엔티티 존재 여부 확인
   */
  async exists(id: string): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        this.handleError(error, 'exists');
      }

      return { data: !!data, error: null };
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }

  /**
   * 엔티티 수 조회
   */
  async count(filters?: TFilter): Promise<ApiResponse<number>> {
    try {
      let query = this.supabase.from(this.tableName).select('*', { count: 'exact', head: true });

      // 필터 적용
      if (filters && this.filterSchema) {
        const validatedFilters = this.validateInput(filters, this.filterSchema, 'count filters');
        query = this.applyFilters(query, validatedFilters);
      }

      const { count, error } = await query;

      if (error) {
        this.handleError(error, 'count');
      }

      return { data: count || 0, error: null };
    } catch (error) {
      this.handleError(error, 'count');
    }
  }
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base Repository Error
 */
export class RepositoryError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends RepositoryError {
  constructor(message: string, public details: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends RepositoryError {
  constructor(message: string = '데이터를 찾을 수 없습니다') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends RepositoryError {
  constructor(message: string = '데이터 충돌이 발생했습니다') {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends RepositoryError {
  constructor(message: string = '접근 권한이 없습니다') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// ============================================================================
// Legacy Type Exports (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use ApiResponse<T> from schemas instead
 */
export interface RepositoryResponse<T> {
  data: T;
  error: null;
}

/**
 * @deprecated Use ApiErrorResponse from schemas instead
 */
export interface RepositoryError {
  data: null;
  error: string;
}

/**
 * @deprecated Use ApiResponse<T> | ApiErrorResponse from schemas instead
 */
export type RepositoryResult<T> = RepositoryResponse<T> | RepositoryError;

/**
 * @deprecated Use FilterOptions from schemas instead
 */
export interface FilterOptions {
  search?: string;
  category?: string;
  tags?: string[];
  author?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * @deprecated Use Sort from schemas instead
 */
export interface SortOptions {
  orderBy?: string;
  order?: 'asc' | 'desc';
}