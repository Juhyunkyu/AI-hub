import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey)

  // 인증 상태 변경 처리
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      // 토큰 갱신 성공 - 로그 출력하지 않음 (정상 동작)
    } else if (event === 'SIGNED_OUT') {
      // 로그아웃 - 로그 출력하지 않음 (정상 동작)
      // 로컬 스토리지 정리
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
        sessionStorage.removeItem('supabase.auth.token')
      }
    }
  })

  return client
}
