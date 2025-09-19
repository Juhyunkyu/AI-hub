import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { postRepository } from '@/lib/repositories';
import { toast } from 'sonner';

/**
 * 게시물 목록 조회 훅
 */
export function usePosts(
  page: number = 1,
  limit: number = 10,
  filters = {},
  sort = { orderBy: 'created_at', order: 'desc' as const }
) {
  return useQuery({
    queryKey: queryKeys.posts.list({ page, limit, filters, sort }),
    queryFn: () => postRepository.getPosts(page, limit, filters, sort),
    staleTime: 1 * 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 게시물 상세 조회 훅
 */
export function usePost(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: () => postRepository.getPostById(postId),
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
    enabled: !!postId,
  });
}

/**
 * 사용자별 게시물 목록 조회 훅
 */
export function usePostsByUser(
  userId: string,
  page: number = 1,
  limit: number = 10
) {
  return useQuery({
    queryKey: queryKeys.profiles.posts(userId),
    queryFn: () => postRepository.getPostsByUser(userId, page, limit),
    staleTime: 1 * 60 * 1000,
    enabled: !!userId,
  });
}

/**
 * 카테고리별 게시물 조회 훅
 */
export function usePostsByCategory(
  categorySlug: string,
  page: number = 1,
  limit: number = 10,
  sort = { orderBy: 'created_at', order: 'desc' as const }
) {
  return useQuery({
    queryKey: queryKeys.categories.posts(categorySlug, { page, limit, sort }),
    queryFn: () => postRepository.getPostsByCategory(categorySlug, page, limit, sort),
    staleTime: 1 * 60 * 1000,
    enabled: !!categorySlug,
  });
}

/**
 * 게시물 검색 훅
 */
export function useSearchPosts(
  query: string,
  page: number = 1,
  limit: number = 10
) {
  return useQuery({
    queryKey: queryKeys.search.posts(query, { page, limit }),
    queryFn: () => postRepository.searchPosts(query, page, limit),
    staleTime: 30 * 1000, // 30초 (검색 결과는 빠르게 변경될 수 있음)
    enabled: query.length >= 2, // 최소 2글자 이상 입력시 검색
  });
}

/**
 * 게시물 생성 뮤테이션 훅
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postData: {
      title: string;
      content: string;
      author_id: string;
      category_id?: string;
      anonymous?: boolean;
      is_notice?: boolean;
    }) => postRepository.createPost(postData),
    onSuccess: (newPost) => {
      // 게시물 목록 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.lists()
      });

      // 카테고리별 게시물 쿼리 무효화
      if (newPost.category_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.categories.all()
        });
      }

      toast.success('게시물이 작성되었습니다');
    },
    onError: (error) => {
      toast.error(`게시물 작성 실패: ${error.message}`);
    }
  });
}

/**
 * 게시물 수정 뮤테이션 훅
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      updates
    }: {
      postId: string;
      updates: {
        title?: string;
        content?: string;
        category_id?: string;
        anonymous?: boolean;
      }
    }) => postRepository.updatePost(postId, updates),
    onSuccess: (updatedPost, { postId }) => {
      // 특정 게시물 쿼리 업데이트
      queryClient.setQueryData(
        queryKeys.posts.detail(postId),
        updatedPost
      );

      // 게시물 목록 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.lists()
      });

      toast.success('게시물이 수정되었습니다');
    },
    onError: (error) => {
      toast.error(`게시물 수정 실패: ${error.message}`);
    }
  });
}

/**
 * 게시물 삭제 뮤테이션 훅
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postRepository.deletePost(postId),
    onSuccess: (_, postId) => {
      // 특정 게시물 쿼리 제거
      queryClient.removeQueries({
        queryKey: queryKeys.posts.detail(postId)
      });

      // 게시물 목록 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.lists()
      });

      toast.success('게시물이 삭제되었습니다');
    },
    onError: (error) => {
      toast.error(`게시물 삭제 실패: ${error.message}`);
    }
  });
}

/**
 * 조회수 증가 뮤테이션 훅
 */
export function useIncrementViewCount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postRepository.incrementViewCount(postId),
    onSuccess: (_, postId) => {
      // 게시물 상세 쿼리 무효화 (조회수 업데이트)
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(postId)
      });
    },
    // 조회수 증가는 사용자에게 알림하지 않음
  });
}