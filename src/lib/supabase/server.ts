import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async getAll() {
        const store = await (cookies() as unknown as Promise<ReturnType<typeof cookies>>)
        return store.getAll().map((c) => ({ name: c.name, value: c.value }))
      },
      async setAll(cookiesToSet) {
        try {
          const store = await (cookies() as unknown as Promise<ReturnType<typeof cookies>>)
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options)
          }
        } catch (_) {
          // In some server component contexts, setting cookies is not allowed.
          // It's safe to ignore here; route handlers/middleware should still persist cookies.
        }
      }
    }
  })
}
