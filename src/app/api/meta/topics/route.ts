import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BodySchema = z.object({ 
  name: z.string().min(1).max(120), 
  slug: z.string().min(1).max(160),
  category_id: z.string().uuid().optional()
})

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
    const supabaseServer = createSupabaseServerClient()
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
      .from('topics')
      .upsert({ 
        slug: parsed.data.slug, 
        name: parsed.data.name,
        category_id: parsed.data.category_id || null
      })
      .select('id,name,category_id')
      .maybeSingle()

    if (error) {
      const { data: existing } = await admin.from('topics').select('id,name,category_id').eq('slug', parsed.data.slug).maybeSingle()
      if (existing) return NextResponse.json(existing)
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: 'server_error', message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'service_role_missing', message: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
    }
    const supabaseServer = createSupabaseServerClient()
    const { data: u } = await supabaseServer.auth.getUser()
    const userId = u.user?.id ?? null
    if (!userId || !isAdmin(userId)) {
      return NextResponse.json({ error: 'forbidden', message: 'not admin' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'invalid_request', message: 'id is required' }, { status: 400 })

    const admin = createSupabaseAdminClient()
    // Optional: prevent deletion if referenced by posts
    const { count } = await admin.from('post_topics').select('post_id', { count: 'exact', head: true }).eq('topic_id', id)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'conflict', message: 'topic is referenced by posts' }, { status: 409 })
    }

    const { error } = await admin.from('topics').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err)
    return NextResponse.json({ error: 'server_error', message }, { status: 500 })
  }
}
