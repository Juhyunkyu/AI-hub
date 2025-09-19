/**
 * Repository 패턴 통합 인덱스
 * 모든 데이터 접근 계층을 중앙에서 관리
 */

// 기본 Repository 클래스와 에러 클래스들
export {
  BaseRepository,
  RepositoryError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from './base-repository';

// 하위 호환성을 위한 타입 재출하기
export type {
  RepositoryResponse,
  RepositoryResult,
  FilterOptions,
  SortOptions
} from './base-repository';

// 새로운 타입들은 schemas에서 가져오기
export type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
  Pagination,
  Sort
} from '@/lib/schemas';

// 게시물 Repository
export { PostRepository, postRepository } from './post-repository';

// 채팅 Repository
export { ChatRepository, chatRepository } from './chat-repository';

// 사용자 Repository
export { UserRepository, userRepository } from './user-repository';

/**
 * 모든 Repository 인스턴스를 포함하는 객체
 * 의존성 주입이나 테스트에서 활용 가능
 */
export const repositories = {
  post: postRepository,
  chat: chatRepository,
  user: userRepository,
} as const;

/**
 * Repository 타입 정의
 */
export type Repositories = typeof repositories;
export type RepositoryType = keyof Repositories;