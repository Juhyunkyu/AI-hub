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
