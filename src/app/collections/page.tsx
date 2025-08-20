import { createSupabaseServerClient } from "@/lib/supabase/server"
import Link from "next/link"

type CollectionItemJoined = { post_id: string; posts: { title: string } | null }

export default async function CollectionsPage() {
  const supabase = createSupabaseServerClient()
  const { data: user } = await supabase.auth.getUser()
  const sessionUser = user.user
  if (!sessionUser) {
    return <div className="mx-auto max-w-3xl px-4 py-6">로그인이 필요합니다.</div>
  }

  const { data: coll } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", sessionUser.id)
    .eq("name", "default")
    .maybeSingle()

  if (!coll) {
    return <div className="mx-auto max-w-3xl px-4 py-6">아직 저장한 게시물이 없습니다.</div>
  }

  const { data: itemsRaw } = await supabase
    .from("collection_items")
    .select("post_id, posts(title)")
    .eq("collection_id", coll.id)

  const items = (itemsRaw ?? []) as unknown as CollectionItemJoined[]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
      <h1 className="text-xl font-semibold">저장한 게시물</h1>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.post_id}>
            <Link href={`/posts/${it.post_id}`} className="hover:underline">{it.posts?.title ?? it.post_id}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
