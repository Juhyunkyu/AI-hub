import { Database } from './supabase'

export type UserRole = Database['public']['Enums']['user_role']
export type PostType = Database['public']['Enums']['post_type']
export type PostStatus = Database['public']['Enums']['post_status']

export type Post = Database['public']['Tables']['posts']['Row']
export type PostInsert = Database['public']['Tables']['posts']['Insert']
export type PostUpdate = Database['public']['Tables']['posts']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export interface PostWithAuthor extends Post {
  author: Profile
}

export interface PostVisibility {
  isPublic: boolean
  visibleToOwner: boolean
  visibleToAdmin: boolean
  showAuthorRole: boolean
}

export const POST_TYPE_LABELS: Record<PostType, string> = {
  general: '일반',
  notice: '공지',
  anonymous: '익명'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  user: '사용자'
}