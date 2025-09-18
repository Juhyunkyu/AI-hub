import { create } from 'zustand'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type AuthUser = {
  id: string
  email: string | null
  username?: string | null
}

export type AuthState = {
  user: AuthUser | null
  isLoading: boolean
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  
  setUser: (user) => {
    set({ user, isLoading: false });
  },
  
  signOut: async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    // 클라이언트 보존 상태 초기화 (테마/컬러테마 등)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('theme')
        localStorage.removeItem('color-theme')
      } catch {}
      try {
        document.documentElement.classList.remove('dark')
        document.documentElement.removeAttribute('data-theme')
      } catch {}
      // 선택적으로 전역 이벤트 발행 (테마 리셋 알림)
      try {
        window.dispatchEvent(new Event('theme:reset'))
      } catch {}
    }
    set({ user: null })
  },
  
  checkAuth: async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        // AuthSessionMissingError는 정상적인 로그아웃 상태이므로 로그 출력하지 않음
        if (error.name !== 'AuthSessionMissingError') {
          console.warn('Auth check error:', error)
        }

        // 토큰이 만료되거나 유효하지 않은 경우 로그아웃 처리
        if (error.message?.includes('refresh') || error.message?.includes('token')) {
          await supabase.auth.signOut()
        }
        set({ user: null, isLoading: false })
        return
      }

      const user = data.user
      set({
        user: user ? { id: user.id, email: user.email ?? null } : null,
        isLoading: false
      })
    } catch (error) {
      console.error('Auth check failed:', error)
      set({ user: null, isLoading: false })
    }
  }
}))
