import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import {
  ProfileSchema,
  CreateProfileSchema,
  UpdateProfileSchema,
  UserFilterSchema,
  FollowSchema,
  CreateReactionSchema,
  type Profile,
  type CreateProfile,
  type UpdateProfile,
  type UserFilter,
  type Follow,
  type ApiResponse,
  type PaginatedResponse
} from '@/lib/schemas';

/**
 * 사용자 Repository 클래스
 * 사용자 프로필 및 팔로우 관계 관리
 */
export class UserRepository extends BaseRepository<Profile, CreateProfile, UpdateProfile, UserFilter> {
  protected tableName = 'profiles';
  protected entitySchema = ProfileSchema;
  protected createSchema = CreateProfileSchema;
  protected updateSchema = UpdateProfileSchema;
  protected filterSchema = UserFilterSchema;

  /**
   * 필터를 적용하는 구체적인 구현
   */
  protected buildFilters(
    query: PostgrestFilterBuilder<Database['public'], Database['public']['Tables']['profiles'], Database['public']['Tables']['profiles']['Row'][], 'profiles'>,
    filters: UserFilter
  ): PostgrestFilterBuilder<Database['public'], Database['public']['Tables']['profiles'], Database['public']['Tables']['profiles']['Row'][], 'profiles'> {
    const { search, role } = filters;

    if (search) {
      query = query.or(`username.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    return query;
  }

  // ============================================================================
  // Extended Methods (사용자 특화 메서드들)
  // ============================================================================

  /**
   * 사용자명으로 프로필 조회
   */
  async findByUsername(username: string): Promise<ApiResponse<Profile | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        this.handleError(error, 'findByUsername');
      }

      const validatedData = data ? this.validateResponse(data, this.entitySchema, 'findByUsername') : null;
      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'findByUsername');
    }
  }

  /**
   * 여러 사용자 ID로 배치 조회
   */
  async findByIds(userIds: string[]): Promise<ApiResponse<Profile[]>> {
    try {
      if (userIds.length === 0) {
        return { data: [], error: null };
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('id', userIds);

      if (error) {
        this.handleError(error, 'findByIds');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, this.entitySchema, 'findByIds item')
      ) || [];

      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'findByIds');
    }
  }

  /**
   * 공개 프로필만 검색
   */
  async searchPublicProfiles(
    searchQuery: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Profile>>> {
    try {
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 19, limit: 20, page: 1 };

      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .or(`username.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
        .order('username', { ascending: true });

      // 공개 프로필만 조회 (is_public 필드가 있다고 가정)
      if ('is_public' in ProfileSchema.shape) {
        query = query.eq('is_public', true);
      }

      query = query.range(paginationParams.from, paginationParams.to);

      const { data, error, count } = await query;

      if (error) {
        this.handleError(error, 'searchPublicProfiles');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, this.entitySchema, 'searchPublicProfiles item')
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
      this.handleError(error, 'searchPublicProfiles');
    }
  }

  // ============================================================================
  // Follow Management Methods
  // ============================================================================

  /**
   * 팔로우 관계 생성
   */
  async followUser(followerId: string, followingId: string): Promise<ApiResponse<Follow>> {
    try {
      // 이미 팔로우하고 있는지 확인
      const { data: existing } = await this.supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

      if (existing) {
        throw new Error('이미 팔로우하고 있습니다');
      }

      // 자기 자신을 팔로우하는 것 방지
      if (followerId === followingId) {
        throw new Error('자기 자신을 팔로우할 수 없습니다');
      }

      const followData = {
        follower_id: followerId,
        following_id: followingId
      };

      const validatedInput = this.validateInput(followData, CreateReactionSchema.omit({
        target_type: true,
        target_id: true,
        user_id: true,
        type: true
      }).extend({
        follower_id: ProfileSchema.shape.id,
        following_id: ProfileSchema.shape.id
      }), 'followUser');

      const { data, error } = await this.supabase
        .from('follows')
        .insert(validatedInput)
        .select()
        .single();

      if (error) {
        this.handleError(error, 'followUser');
      }

      const validatedData = this.validateResponse(data, FollowSchema, 'followUser');
      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'followUser');
    }
  }

  /**
   * 언팔로우
   */
  async unfollowUser(followerId: string, followingId: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const { error } = await this.supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      if (error) {
        this.handleError(error, 'unfollowUser');
      }

      return { data: { success: true }, error: null };
    } catch (error) {
      this.handleError(error, 'unfollowUser');
    }
  }

  /**
   * 팔로우 상태 확인
   */
  async isFollowing(followerId: string, followingId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await this.supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        this.handleError(error, 'isFollowing');
      }

      return { data: !!data, error: null };
    } catch (error) {
      this.handleError(error, 'isFollowing');
    }
  }

  /**
   * 팔로워 목록 조회
   */
  async getFollowers(
    userId: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Follow & { follower: Profile }>>> {
    try {
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 19, limit: 20, page: 1 };

      const { data, error, count } = await this.supabase
        .from('follows')
        .select(`
          *,
          follower:profiles!follower_id(*)
        `, { count: 'exact' })
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .range(paginationParams.from, paginationParams.to);

      if (error) {
        this.handleError(error, 'getFollowers');
      }

      const validatedData = data?.map(item => {
        const follow = this.validateResponse(item, FollowSchema.extend({
          follower: ProfileSchema
        }), 'getFollowers item');
        return follow;
      }) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData as Database['public']['Tables']['profiles']['Update'],
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'getFollowers');
    }
  }

  /**
   * 팔로잉 목록 조회
   */
  async getFollowing(
    userId: string,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<Follow & { following: Profile }>>> {
    try {
      const paginationParams = pagination ? this.getPaginationParams(pagination) : { from: 0, to: 19, limit: 20, page: 1 };

      const { data, error, count } = await this.supabase
        .from('follows')
        .select(`
          *,
          following:profiles!following_id(*)
        `, { count: 'exact' })
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .range(paginationParams.from, paginationParams.to);

      if (error) {
        this.handleError(error, 'getFollowing');
      }

      const validatedData = data?.map(item => {
        const follow = this.validateResponse(item, FollowSchema.extend({
          following: ProfileSchema
        }), 'getFollowing item');
        return follow;
      }) || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / paginationParams.limit);

      return {
        data: {
          data: validatedData as Database['public']['Tables']['profiles']['Update'],
          total,
          page: paginationParams.page,
          limit: paginationParams.limit,
          totalPages
        },
        error: null
      };
    } catch (error) {
      this.handleError(error, 'getFollowing');
    }
  }

  /**
   * 팔로워/팔로잉 수 조회
   */
  async getFollowCounts(userId: string): Promise<ApiResponse<{
    followerCount: number;
    followingCount: number;
  }>> {
    try {
      const [followersResult, followingResult] = await Promise.all([
        this.supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', userId),
        this.supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId)
      ]);

      if (followersResult.error) {
        this.handleError(followersResult.error, 'getFollowCounts - followers');
      }

      if (followingResult.error) {
        this.handleError(followingResult.error, 'getFollowCounts - following');
      }

      const data = {
        followerCount: followersResult.count || 0,
        followingCount: followingResult.count || 0
      };

      return { data, error: null };
    } catch (error) {
      this.handleError(error, 'getFollowCounts');
    }
  }

  /**
   * 사용자 통계 조회 (게시물, 팔로워, 팔로잉 수)
   */
  async getUserStats(userId: string): Promise<ApiResponse<{
    postCount: number;
    followerCount: number;
    followingCount: number;
  }>> {
    try {
      const [postsResult, followCountsResult] = await Promise.all([
        this.supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', userId),
        this.getFollowCounts(userId)
      ]);

      if (postsResult.error) {
        this.handleError(postsResult.error, 'getUserStats - posts');
      }

      if (followCountsResult.error) {
        throw followCountsResult.error;
      }

      const data = {
        postCount: postsResult.count || 0,
        ...followCountsResult.data
      };

      return { data, error: null };
    } catch (error) {
      this.handleError(error, 'getUserStats');
    }
  }

  /**
   * 추천 사용자 목록 (최근 가입한 공개 사용자)
   */
  async getRecommendedUsers(
    currentUserId?: string,
    limit: number = 10
  ): Promise<ApiResponse<Profile[]>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // 공개 프로필만 조회 (is_public 필드가 있다고 가정)
      if ('is_public' in ProfileSchema.shape) {
        query = query.eq('is_public', true);
      }

      // 현재 사용자 제외
      if (currentUserId) {
        query = query.neq('id', currentUserId);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError(error, 'getRecommendedUsers');
      }

      const validatedData = data?.map(item =>
        this.validateResponse(item, this.entitySchema, 'getRecommendedUsers item')
      ) || [];

      return { data: validatedData, error: null };
    } catch (error) {
      this.handleError(error, 'getRecommendedUsers');
    }
  }

  /**
   * 사용자 역할 업데이트 (관리자 전용)
   */
  async updateUserRole(
    userId: string,
    role: 'user' | 'moderator' | 'admin'
  ): Promise<ApiResponse<Profile>> {
    return this.update(userId, { role } as UpdateProfile);
  }

  /**
   * 사용자 활성/비활성 상태 토글
   */
  async toggleUserStatus(userId: string): Promise<ApiResponse<Profile>> {
    try {
      // 현재 상태 조회
      const currentUser = await this.findById(userId);
      if (currentUser.error || !currentUser.data) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 상태 토글 (is_active 필드가 있다고 가정)
      const newStatus = !currentUser.data?.is_active;
      return this.update(userId, { is_active: newStatus } as UpdateProfile);
    } catch (error) {
      this.handleError(error, 'toggleUserStatus');
    }
  }

  /**
   * 사용자 아바타 URL 업데이트
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<ApiResponse<Profile>> {
    return this.update(userId, { avatar_url: avatarUrl });
  }

  /**
   * 사용자명 중복 확인
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<ApiResponse<boolean>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('id')
        .eq('username', username);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        this.handleError(error, 'isUsernameAvailable');
      }

      return { data: !data, error: null };
    } catch (error) {
      this.handleError(error, 'isUsernameAvailable');
    }
  }
}

// 싱글톤 인스턴스 생성
export const userRepository = new UserRepository();