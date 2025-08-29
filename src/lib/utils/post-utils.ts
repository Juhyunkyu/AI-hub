import { PostType, UserRole } from '@/types/post'

/**
 * 관리자 권한 확인 유틸리티
 */
export function isAdmin(userId: string | null): boolean {
  if (!userId) return false
  
  const adminUserIds = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  
  return adminUserIds.includes(userId)
}

/**
 * 공지사항 작성 권한 확인
 */
export function canCreateNotice(userId: string | null, userRole?: UserRole): boolean {
  return isAdmin(userId) || userRole === 'admin'
}

/**
 * 게시글 타입별 가시성 확인
 */
export function getPostVisibility(postType: PostType, authorId: string, currentUserId?: string | null) {
  switch (postType) {
    case 'notice':
      return {
        isPublic: true,
        showAuthorAsAdmin: true,
        requiresAdminRole: true
      }
    case 'anonymous':
      return {
        isPublic: false,
        showAuthorAsAdmin: false,
        requiresOwnership: true,
        visibleToOwnerOnly: currentUserId === authorId
      }
    case 'general':
    default:
      return {
        isPublic: true,
        showAuthorAsAdmin: false,
        requiresAdminRole: false
      }
  }
}

/**
 * 전역 공지사항 여부 확인
 */
export function isGlobalNotice(isNotice: boolean, pinScope?: string): boolean {
  return isNotice && pinScope === "global"
}

/**
 * 게시글 타입별 사용 가능한 옵션 반환
 */
export function getAvailablePostTypes(isAdminUser: boolean): PostType[] {
  return isAdminUser 
    ? ['general', 'notice', 'anonymous']
    : ['general', 'anonymous']
}