/**
 * TanStack Query 키 팩토리
 * 일관된 쿼리 키 관리를 위한 중앙화된 시스템
 */

export const queryKeys = {
  // 전체 앱 관련
  all: ['app'] as const,

  // 인증 관련
  auth: {
    all: () => [...queryKeys.all, 'auth'] as const,
    user: () => [...queryKeys.auth.all(), 'user'] as const,
    profile: (userId?: string) => [...queryKeys.auth.all(), 'profile', userId] as const,
  },

  // 게시물 관련
  posts: {
    all: () => [...queryKeys.all, 'posts'] as const,
    lists: () => [...queryKeys.posts.all(), 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all(), 'detail'] as const,
    detail: (postId: string) => [...queryKeys.posts.details(), postId] as const,
    comments: (postId: string) => [...queryKeys.posts.detail(postId), 'comments'] as const,
    reactions: (postId: string) => [...queryKeys.posts.detail(postId), 'reactions'] as const,
  },

  // 채팅 관련
  chat: {
    all: () => [...queryKeys.all, 'chat'] as const,
    rooms: () => [...queryKeys.chat.all(), 'rooms'] as const,
    room: (roomId: string) => [...queryKeys.chat.all(), 'room', roomId] as const,
    messages: (roomId: string, page?: number) => [...queryKeys.chat.room(roomId), 'messages', page] as const,
    unreadCount: () => [...queryKeys.chat.all(), 'unread'] as const,
  },

  // 프로필 관련
  profiles: {
    all: () => [...queryKeys.all, 'profiles'] as const,
    detail: (username: string) => [...queryKeys.profiles.all(), username] as const,
    posts: (username: string) => [...queryKeys.profiles.detail(username), 'posts'] as const,
    followers: (username: string) => [...queryKeys.profiles.detail(username), 'followers'] as const,
    following: (username: string) => [...queryKeys.profiles.detail(username), 'following'] as const,
  },

  // 카테고리 관련
  categories: {
    all: () => [...queryKeys.all, 'categories'] as const,
    list: () => [...queryKeys.categories.all(), 'list'] as const,
    detail: (slug: string) => [...queryKeys.categories.all(), slug] as const,
    posts: (slug: string, filters?: Record<string, any>) =>
      [...queryKeys.categories.detail(slug), 'posts', filters] as const,
  },

  // 검색 관련
  search: {
    all: () => [...queryKeys.all, 'search'] as const,
    posts: (query: string, filters?: Record<string, any>) =>
      [...queryKeys.search.all(), 'posts', query, filters] as const,
    users: (query: string) => [...queryKeys.search.all(), 'users', query] as const,
  },

  // 알림 관련
  notifications: {
    all: () => [...queryKeys.all, 'notifications'] as const,
    list: (page?: number) => [...queryKeys.notifications.all(), 'list', page] as const,
    unreadCount: () => [...queryKeys.notifications.all(), 'unread'] as const,
  },
} as const;

/**
 * 쿼리 키 타입 유틸리티
 */
export type QueryKey = typeof queryKeys;
export type PostQueryKey = typeof queryKeys.posts;
export type ChatQueryKey = typeof queryKeys.chat;