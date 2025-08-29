---
inclusion: always
---

# Next.js 15 + Supabase 개발 패턴

## Supabase 클라이언트 생성 패턴

### Server Components용 클라이언트
```typescript
// utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 쿠키 설정 불가
          }
        },
      },
    }
  )
}
```

### Client Components용 클라이언트
```typescript
// utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Middleware용 클라이언트
```typescript
// utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 중요: auth.getUser() 호출 필수
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 인증이 필요한 페이지 보호
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

## 인증 패턴

### Server Component에서 인증 확인
```typescript
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <div>Hello {user.email}</div>
}
```

### Client Component에서 인증 처리
```typescript
'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      console.error('Error:', error.message)
      return
    }
    
    router.refresh()
    router.push('/')
  }

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="button" onClick={handleSignIn}>
        Sign In
      </button>
    </form>
  )
}
```

### Server Actions를 활용한 인증
```typescript
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

## 데이터 페칭 패턴

### Server Component에서 데이터 페칭
```typescript
import { createClient } from '@/utils/supabase/server'

async function getPosts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles(username, avatar_url),
      comments(count)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return []
  }

  return data
}

export default async function PostsPage() {
  const posts = await getPosts()

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### Client Component에서 실시간 데이터
```typescript
'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

export default function RealtimeComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const supabase = createClient()

  useEffect(() => {
    // 초기 데이터 로드
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      
      if (data) setComments(data)
    }

    fetchComments()

    // 실시간 구독
    const channel = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments((prev) => [...prev, payload.new as Comment])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [postId, supabase])

  return (
    <div>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  )
}
```

## Route Handlers 패턴

### API 라우트에서 인증 확인
```typescript
// app/api/posts/route.ts
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  
  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...body,
      author_id: user.id,
    })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data[0])
}
```

## RLS 정책 패턴

### 기본 CRUD 정책
```sql
-- 테이블 RLS 활성화
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책
CREATE POLICY "Anyone can view published posts" ON posts
  FOR SELECT USING (status = 'published');

-- 소유자 쓰기 정책
CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = author_id);
```

### 관계형 데이터 정책
```sql
-- 댓글 정책 (게시물이 공개된 경우에만)
CREATE POLICY "Comments visible for published posts" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = comments.post_id 
      AND posts.status = 'published'
    )
  );

-- 팔로우 관계 정책
CREATE POLICY "Users can view all follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);
```

## 에러 처리 패턴

### Global Error Boundary
```typescript
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
```

### API 에러 처리
```typescript
// utils/api.ts
export async function handleApiCall<T>(
  apiCall: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await apiCall()
    return { data, error: null }
  } catch (error) {
    console.error('API Error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// 사용 예시
const { data, error } = await handleApiCall(() =>
  supabase.from('posts').select('*')
)

if (error) {
  toast.error(error)
  return
}
```

## 타입 안전성 패턴

### Supabase 타입 생성
```bash
# 타입 생성 명령어
npx supabase gen types typescript --local > src/types/supabase.ts
```

### 타입 활용
```typescript
import { Database } from '@/types/supabase'

type Post = Database['public']['Tables']['posts']['Row']
type PostInsert = Database['public']['Tables']['posts']['Insert']
type PostUpdate = Database['public']['Tables']['posts']['Update']

// 타입이 적용된 클라이언트
const supabase = createClient<Database>()
```

## 성능 최적화 패턴

### 캐싱 전략
```typescript
import { unstable_cache } from 'next/cache'

const getCachedPosts = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data } = await supabase.from('posts').select('*')
    return data
  },
  ['posts'],
  { 
    revalidate: 300, // 5분
    tags: ['posts'] 
  }
)

// 캐시 무효화
import { revalidateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  // 게시물 생성 로직
  revalidateTag('posts')
}
```

### 이미지 최적화
```typescript
import Image from 'next/image'

function UserAvatar({ user }: { user: User }) {
  return (
    <Image
      src={user.avatar_url || '/default-avatar.png'}
      alt={`${user.username}'s avatar`}
      width={40}
      height={40}
      className="rounded-full"
      priority={false}
    />
  )
}
```

이러한 패턴들을 일관되게 적용하여 안정적이고 확장 가능한 애플리케이션을 구축하세요.