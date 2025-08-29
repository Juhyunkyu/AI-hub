# Design Document

## Overview

AI 지식 교류/공유 허브는 Next.js 15 App Router와 Supabase를 기반으로 한 현대적인 웹 애플리케이션입니다. 이 시스템은 Server Components를 우선으로 하는 아키텍처를 채택하여 성능을 최적화하고, Row Level Security(RLS)를 통해 데이터 보안을 보장하며, 실시간 상호작용을 지원합니다.

## Architecture

### Frontend Architecture (Next.js 15 App Router)

#### Component Strategy
- **Server Components 우선**: 기본적으로 모든 컴포넌트는 Server Component로 구현
- **Client Components 최소화**: 상호작용, 상태 관리, 브라우저 API가 필요한 경우에만 'use client' 사용
- **Streaming UI**: React Suspense와 Loading UI를 활용한 점진적 UI 렌더링

#### Data Fetching Pattern
```typescript
// Server Component에서 직접 데이터 페칭
async function getPosts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  return data
}

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}
```

#### Authentication Flow
- **Middleware 기반 인증**: Next.js middleware에서 Supabase 세션 관리
- **Server-side 세션 검증**: Server Components에서 `auth.getUser()` 호출
- **Cookie 기반 세션**: `@supabase/ssr`를 통한 안전한 쿠키 관리

### Backend Architecture (Supabase)

#### Database Design
- **PostgreSQL**: 메인 데이터베이스
- **UUID v4**: 모든 테이블의 기본 키
- **Row Level Security**: 모든 테이블에 RLS 정책 적용
- **Triggers**: 자동 프로필 생성, 알림 생성 등

#### Authentication Strategy
- **Supabase Auth**: 이메일/비밀번호, OAuth (Google, GitHub)
- **JWT 토큰**: 자동 토큰 갱신 및 검증
- **Role-based Access**: user, moderator, admin 역할 구분

## Components and Interfaces

### Core Components

#### 1. Authentication Components
```typescript
// Server Component - 인증 상태 확인
async function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return <>{children}</>
}

// Client Component - 로그인 폼
'use client'
function LoginForm() {
  const supabase = createClient()
  // 로그인 로직
}
```

#### 2. Post Management Components
```typescript
// Server Component - 게시물 목록
async function PostsList() {
  const posts = await getPosts()
  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

// Client Component - 게시물 작성
'use client'
function PostEditor() {
  // 상태 관리 및 폼 처리
}
```

#### 3. Real-time Components
```typescript
// Client Component - 실시간 댓글
'use client'
function CommentSection({ postId }: { postId: string }) {
  const supabase = createClient()
  
  useEffect(() => {
    const channel = supabase
      .channel('comments')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`
      }, (payload) => {
        // 새 댓글 처리
      })
      .subscribe()
    
    return () => supabase.removeChannel(channel)
  }, [postId])
}
```

### State Management (Zustand)

#### Store Architecture
```typescript
// Auth Store
interface AuthState {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// UI Store
interface UIState {
  theme: 'light' | 'dark'
  modals: Record<string, boolean>
  toasts: Toast[]
  toggleTheme: () => void
  showModal: (id: string) => void
  addToast: (toast: Toast) => void
}

// Feed Store
interface FeedState {
  posts: Post[]
  filters: FeedFilters
  pagination: PaginationState
  fetchPosts: () => Promise<void>
  updateFilters: (filters: Partial<FeedFilters>) => void
}
```

### API Layer (Route Handlers)

#### RESTful API Design
```typescript
// app/api/posts/route.ts
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  
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
    .insert({ ...body, author_id: user.id })
    .select()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  
  return NextResponse.json(data[0])
}
```

## Data Models

### Database Schema

#### Core Tables
```sql
-- 사용자 프로필
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 게시물
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 댓글
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id),
  post_id UUID NOT NULL REFERENCES posts(id),
  parent_id UUID REFERENCES comments(id),
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 리액션 (좋아요, 저장 등)
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('like', 'save')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(target_type, target_id, user_id, type)
);

-- 팔로우 관계
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id),
  following_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- 쪽지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  to_user_id UUID NOT NULL REFERENCES profiles(id),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  deleted_by_sender BOOLEAN DEFAULT FALSE,
  deleted_by_receiver BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 신고
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 알림
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'message')),
  payload JSONB NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Row Level Security Policies
```sql
-- 프로필 RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 게시물 RLS 정책
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are viewable by everyone" ON posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = author_id);

-- 댓글 RLS 정책
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published comments are viewable by everyone" ON comments
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can insert comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = author_id);

-- 리액션 RLS 정책
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions" ON reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own reactions" ON reactions
  FOR ALL USING (auth.uid() = user_id);

-- 팔로우 RLS 정책
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- 쪽지 RLS 정책
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- 신고 RLS 정책
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 알림 RLS 정책
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
```

## Error Handling

### Client-Side Error Handling
```typescript
// Error Boundary
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
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}

// API Error Handling
async function handleApiCall<T>(apiCall: () => Promise<T>): Promise<T | null> {
  try {
    return await apiCall()
  } catch (error) {
    console.error('API Error:', error)
    toast.error('An error occurred. Please try again.')
    return null
  }
}
```

### Server-Side Error Handling
```typescript
// Route Handler Error Handling
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }
    
    // 비즈니스 로직
    
  } catch (error) {
    console.error('Server Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    )
  }
}
```

## Testing Strategy

### Unit Testing
```typescript
// Component Testing with React Testing Library
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import PostCard from '@/components/PostCard'

test('PostCard renders post title', () => {
  const mockPost = {
    id: '1',
    title: 'Test Post',
    content: 'Test content',
    author: { username: 'testuser' }
  }
  
  render(<PostCard post={mockPost} />)
  expect(screen.getByText('Test Post')).toBeInTheDocument()
})
```

### Integration Testing
```typescript
// API Route Testing
import { POST } from '@/app/api/posts/route'
import { NextRequest } from 'next/server'

test('POST /api/posts creates a new post', async () => {
  const request = new NextRequest('http://localhost:3000/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test Post',
      content: 'Test content'
    })
  })
  
  const response = await POST(request)
  expect(response.status).toBe(201)
})
```

### E2E Testing with Playwright
```typescript
import { test, expect } from '@playwright/test'

test('user can create a post', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password')
  await page.click('button[type="submit"]')
  
  await page.goto('/posts/new')
  await page.fill('[name="title"]', 'Test Post')
  await page.fill('[name="content"]', 'Test content')
  await page.click('button[type="submit"]')
  
  await expect(page.locator('text=Test Post')).toBeVisible()
})
```

## Performance Optimization

### Caching Strategy
```typescript
// Static Generation with ISR
export const revalidate = 3600 // 1시간마다 재생성

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsList posts={posts} />
}

// Dynamic with Cache Tags
import { unstable_cache } from 'next/cache'

const getCachedPosts = unstable_cache(
  async () => {
    const supabase = await createClient()
    const { data } = await supabase.from('posts').select('*')
    return data
  },
  ['posts'],
  { revalidate: 300, tags: ['posts'] }
)
```

### Image Optimization
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

### Bundle Optimization
```typescript
// Dynamic Imports for Client Components
import dynamic from 'next/dynamic'

const CommentEditor = dynamic(() => import('@/components/CommentEditor'), {
  loading: () => <div>Loading editor...</div>,
  ssr: false
})
```

## Security Considerations

### Authentication Security
- JWT 토큰 자동 갱신
- Secure, HttpOnly 쿠키 사용
- CSRF 보호 (SameSite 쿠키)
- Rate limiting on auth endpoints

### Data Security
- 모든 테이블에 RLS 정책 적용
- 입력 데이터 검증 (Zod 스키마)
- SQL Injection 방지 (Supabase 자동 처리)
- XSS 방지 (DOMPurify 사용)

### File Upload Security
```typescript
// 안전한 파일 업로드
export async function uploadAvatar(file: File) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Unauthorized')
  
  // 파일 타입 및 크기 검증
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type')
  }
  
  if (file.size > 5 * 1024 * 1024) { // 5MB
    throw new Error('File too large')
  }
  
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true })
  
  if (error) throw error
  return data
}
```

## Deployment and Infrastructure

### Vercel Deployment
- Next.js 15 최적화된 빌드
- Edge Runtime 활용
- 환경 변수 관리
- Preview deployments

### Supabase Configuration
- Production 데이터베이스 설정
- RLS 정책 검증
- 백업 및 복구 전략
- 모니터링 및 알림

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Next.js
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=your_app_url
```

이 설계는 Next.js 15의 최신 기능과 Supabase의 강력한 백엔드 서비스를 활용하여 확장 가능하고 안전한 AI 지식 공유 플랫폼을 구축하는 것을 목표로 합니다.