import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getUserIdFromSupabaseCookie(request: NextRequest): string | null {
  // Supabase 프로젝트별 쿠키 패턴 찾기
  const cookies = request.cookies.getAll()
  const authCookie = cookies.find(cookie => 
    cookie.name.startsWith('sb-') && 
    cookie.name.includes('-auth-token') &&
    cookie.name.endsWith('.0')
  )
  
  if (!authCookie?.value) {
    return null
  }
  
  // 쿠키 값이 존재하면 로그인된 것으로 간주
  return 'authenticated'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Admin 페이지만 보호
  if (pathname.startsWith('/admin')) {
    const userId = getUserIdFromSupabaseCookie(request)
    if (!userId) {
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }
    const adminEnv = process.env.ADMIN_USER_IDS || ''
    if (adminEnv.trim().length > 0) {
      const allowed = adminEnv.split(',').map((s) => s.trim())
      if (!allowed.includes(userId)) {
        const url = new URL('/', request.url)
        return NextResponse.redirect(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
