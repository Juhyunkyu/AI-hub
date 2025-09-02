import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BodySchema = z.object({ name: z.string().min(1).max(120), slug: z.string().min(1).max(160) })

function isAdmin(userId: string | null): boolean {
  const allowed = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.length === 0) return false
  if (!userId) return false
  return allowed.includes(userId)
}

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'service_role_missing', message: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
    }
    const supabaseServer = await createSupabaseServerClient()
    const { data: u } = await supabaseServer.auth.getUser()
    const userId = u.user?.id ?? null
    if (!userId || !isAdmin(userId)) {
      return NextResponse.json({ error: 'forbidden', message: 'not admin' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('tags')
      .upsert({ slug: parsed.data.slug, name: parsed.data.name })
      .select('id,name')
      .maybeSingle()

    if (error) {
      const { data: existing } = await admin.from('tags').select('id,name').eq('slug', parsed.data.slug).maybeSingle()
      if (existing) return NextResponse.json(existing)
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: 'server_error', message }, { status: 500 })
  }
}
