import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import {
  PostSchema,
  CreatePostSchema,
  UpdatePostSchema,
  PostFilterSchema,
  type Post,
  type CreatePost,
  type UpdatePost,
  type PostFilter,
  type ApiResponse,
  type PaginatedResponse
} from '@/lib/schemas';

/**
 * 게시물 Repository 클래스
 * 게시물 관련 모든 데이터 접근 로직을 담당
 */
export class PostRepository extends BaseRepository<Post, CreatePost, UpdatePost, PostFilter> {
  protected tableName = 'posts';
  protected entitySchema = PostSchema;
  protected createSchema = CreatePostSchema;
  protected updateSchema = UpdatePostSchema;
  protected filterSchema = PostFilterSchema;

  /**
   * 필터를 적용하는 구체적인 구현
   */
  protected buildFilters(
    query: PostgrestFilterBuilder<Database['public'], Database['public']['Tables']['posts'], Database['public']['Tables']['posts']['Row'][], 'posts'>,
    filters: PostFilter
  ): PostgrestFilterBuilder<Database['public'], Database['public']['Tables']['posts'], Database['public']['Tables']['posts']['Row'][], 'posts'> {
    const { search, category, tags, author, status, post_type, dateFrom, dateTo } = filters;

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category_id', category);
    }

    if (tags && tags.length > 0) {
      // 태그는 JSON 배열로 저장되어 있다고 가정
      query = query.overlaps('tags', tags);
    }

    if (author) {
      query = query.eq('author_id', author);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (post_type) {
      query = query.eq('post_type', post_type);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    return query;
  }

  // ============================================================================
  // Extended Methods (게시물 특화 메서드들)
  // ============================================================================

  /**
   * 작성자 정보와 함께 게시물 상세 조회
   */
  async findByIdWithAuthor(id: string): Promise<ApiResponse<Post & { author: Database['public']['Tables']['profiles']['Row'] } | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          profiles!author_id (
            id,
            username,
            avatar_url,
            role
          ),
          categories (
            id,
            name,
            slug
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        this.handleError(error, 'findByIdWithAuthor');
      }

      const validatedData = data ? this.validateResponse(data, PostSchema.extend({
        profiles: PostSchema.shape.author_id.optional(),
        categories: PostSchema.shape.id.optional()
      }), 'findByIdWithAuthor') : null;

      return { data: validatedData as any, error: null };
    } catch (error) {
      this.handleError(error, 'findByIdWithAuthor');
    }
  }

  /**
   * 게시물 목록을 작성자 정보와 함께 조회
   */
  async findAllWithAuthor(
    filters?: PostFilter,
    pagination?: { page: number; limit: number },
    sort?: { orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<ApiResponse<PaginatedResponse<Post & { author: Database['public']['Tables']['profiles']['Row'] }>>> {
    try {
      // 기본값 설정
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 9, limit: 10, page: 1 };
      const sortParams = sort ? this.buildOrderBy(sort) : null;

      // 기본 쿼리 구성
      let query = this.supabase
        .from(this.tableName)
        .select(`
          *,
          profiles!author_id (
            id,
            username,
            avatar_url,
            role
          ),
          categories (
            id,
            name,
            slug
          )
        `, { count: 'exact' });

      // 필터 적용
      if (filters && this.filterSchema) {
        const validatedFilters = this.validateInput(filters, this.filterSchema, 'findAllWithAuthor filters');
        query = this.applyFilters(query, validatedFilters);
      }

      // 정렬 적용
      if (sortParams) {
        query = query.order(sortParams.column, { ascending: sortParams.ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // 페이지네이션 적용
      query = query.range(paginationParams.from, paginationParams.to);

      const { data, error, count } = await query;

      if (error) {
        this.handleError(error, 'findAllWithAuthor');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, PostSchema.extend({
          profiles: PostSchema.shape.author_id.optional(),
          categories: PostSchema.shape.id.optional()
        }), 'findAllWithAuthor item')
      ) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData as any,
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'findAllWithAuthor');
    }
  }

  /**
   * 게시물 조회수 증가
   */
  async incrementViewCount(id: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const { error } = await this.supabase.rpc('increment_post_view_count', {
        post_id: id
      });

      if (error) {
        this.handleError(error, 'incrementViewCount');
      }

      return { data: { success: true }, error: null };
    } catch (error) {
      this.handleError(error, 'incrementViewCount');
    }
  }

  /**
   * 사용자의 게시물 목록 조회
   */
  async findByAuthor(
    authorId: string,
    pagination?: { page: number; limit: number },
    sort?: { orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<ApiResponse<PaginatedResponse<Post>>> {
    const filters: PostFilter = {
      author: authorId,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      orderBy: sort?.orderBy || 'created_at',
      order: sort?.order || 'desc'
    };

    return this.findAll(filters, pagination, sort);
  }

  /**
   * 카테고리별 게시물 목록 조회
   */
  async findByCategory(
    categorySlug: string,
    pagination?: { page: number; limit: number },
    sort?: { orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<ApiResponse<PaginatedResponse<Post>>> {
    try {
      // 카테고리 ID 조회
      const { data: category, error: categoryError } = await this.supabase
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();

      if (categoryError) {
        this.handleError(categoryError, 'findByCategory - category lookup');
      }

      if (!category) {
        throw new Error('카테고리를 찾을 수 없습니다');
      }

      const filters: PostFilter = {
        category: category.id,
        page: pagination?.page || 1,
        limit: pagination?.limit || 10,
        orderBy: sort?.orderBy || 'created_at',
        order: sort?.order || 'desc'
      };

      return this.findAll(filters, pagination, sort);

    } catch (error) {
      this.handleError(error, 'findByCategory');
    }
  }

  /**
   * 검색 결과 조회
   */
  async search(
    searchQuery: string,
    pagination?: { page: number; limit: number },
    sort?: { orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<ApiResponse<PaginatedResponse<Post>>> {
    const filters: PostFilter = {
      search: searchQuery,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      orderBy: sort?.orderBy || 'created_at',
      order: sort?.order || 'desc'
    };

    return this.findAll(filters, pagination, sort);
  }

  /**
   * 공지사항 게시물 조회
   */
  async findNotices(
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Post>>> {
    try {
      // is_notice 필드가 있다고 가정
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 9, limit: 10, page: 1 };

      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('is_notice', true)
        .order('created_at', { ascending: false });

      query = query.range(paginationParams.from, paginationParams.to);

      const { data, error, count } = await query;

      if (error) {
        this.handleError(error, 'findNotices');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, this.entitySchema, 'findNotices item')
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
      this.handleError(error, 'findNotices');
    }
  }

  /**
   * 게시물 상태 변경 (발행/초안/보관)
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'published' | 'archived' | 'deleted'
  ): Promise<ApiResponse<Post>> {
    return this.update(id, { status } as UpdatePost);
  }

  /**
   * 게시물 통계 조회
   */
  async getStats(): Promise<ApiResponse<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    deleted: number;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('status');

      if (error) {
        this.handleError(error, 'getStats');
      }

      const stats = {
        total: data?.length || 0,
        published: data?.filter(post => post.status === 'published').length || 0,
        draft: data?.filter(post => post.status === 'draft').length || 0,
        archived: data?.filter(post => post.status === 'archived').length || 0,
        deleted: data?.filter(post => post.status === 'deleted').length || 0,
      };

      return { data: stats, error: null };
    } catch (error) {
      this.handleError(error, 'getStats');
    }
  }
}

// 싱글톤 인스턴스 생성
export const postRepository = new PostRepository();