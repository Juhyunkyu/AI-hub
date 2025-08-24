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

export const useAuthStore = create<AuthState>((set, get) => ({
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
    const supabase = createSupabaseBrowserClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    set({ 
      user: user ? { id: user.id, email: user.email ?? null } : null,
      isLoading: false 
    })
  }
}))
