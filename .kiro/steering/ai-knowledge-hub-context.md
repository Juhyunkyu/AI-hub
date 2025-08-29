---
inclusion: always
---

# AI 지식 교류/공유 허브 - 프로젝트 컨텍스트

## 프로젝트 개요

이 프로젝트는 Next.js 15 App Router와 Supabase를 기반으로 한 AI 지식 공유 커뮤니티 플랫폼입니다. 사용자들이 AI 관련 정보를 게시하고, 댓글과 리액션을 통해 상호작용하며, 개인화된 피드를 통해 관심 있는 정보를 효율적으로 탐색할 수 있는 환경을 제공합니다.

## 기술 스택

### Frontend
- **Next.js 15**: App Router, Server Components 우선
- **TypeScript**: 엄격한 타입 안전성
- **TailwindCSS**: 유틸리티 우선 스타일링
- **shadcn/ui**: 일관된 UI 컴포넌트 시스템
- **Lucide React**: 아이콘 라이브러리
- **Zustand**: 클라이언트 상태 관리

### Backend
- **Supabase**: PostgreSQL 데이터베이스, 인증, 실시간, 스토리지
- **Row Level Security (RLS)**: 데이터 보안
- **PostgreSQL**: 메인 데이터베이스
- **Supabase Auth**: 이메일/OAuth 인증

## 아키텍처 원칙

### Next.js 15 App Router 패턴
1. **Server Components 우선**: 기본적으로 모든 컴포넌트는 Server Component
2. **Client Components 최소화**: 상호작용, 상태, 브라우저 API 필요시에만 'use client'
3. **데이터 페칭**: Server Components에서 직접 fetch, Route Handlers는 Client Components용
4. **Streaming UI**: React Suspense와 Loading UI 활용

### Supabase 통합 패턴
1. **인증 플로우**: Middleware → Server Components → Client Components
2. **RLS 정책**: 모든 테이블에 적용, 최소 권한 원칙
3. **실시간 기능**: Supabase Realtime 채널 활용
4. **파일 업로드**: Storage 버킷과 RLS 정책 연동

## 코딩 규칙

### TypeScript 규칙
```typescript
// 명시적 타입 정의 선호
interface User {
  id: string
  username: string
  email: string
}

// 함수 시그니처 명시
async function createPost(data: CreatePostData): Promise<Post | null> {
  // 구현
}
```

### 컴포넌트 패턴
```typescript
// Server Component (기본)
async function PostsList() {
  const posts = await getPosts()
  return <div>{/* 렌더링 */}</div>
}

// Client Component (필요시에만)
'use client'
function InteractiveButton() {
  const [state, setState] = useState()
  return <button onClick={() => setState()}>Click</button>
}
```

### 에러 처리 패턴
```typescript
// API 응답 표준화
type ApiResponse<T> = {
  data?: T
  error?: string
  success: boolean
}

// 에러 바운더리 활용
export default function GlobalError({ error, reset }: ErrorProps) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

## 데이터베이스 설계 원칙

### 테이블 네이밍
- 테이블명: 복수형 snake_case (예: `user_profiles`, `blog_posts`)
- 컬럼명: snake_case (예: `created_at`, `user_id`)
- 외래키: `{table}_id` 형식 (예: `author_id`, `post_id`)

### RLS 정책 패턴
```sql
-- 기본 패턴: 소유자만 접근
CREATE POLICY "Users can manage their own data" ON table_name
  FOR ALL USING (auth.uid() = user_id);

-- 공개 읽기, 소유자 쓰기
CREATE POLICY "Public read, owner write" ON table_name
  FOR SELECT USING (true);
  
CREATE POLICY "Owner can insert/update" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 성능 최적화 가이드

### 캐싱 전략
```typescript
// Static Generation with ISR
export const revalidate = 3600 // 1시간

// Dynamic with Cache Tags
const getCachedData = unstable_cache(
  async () => fetchData(),
  ['cache-key'],
  { revalidate: 300, tags: ['posts'] }
)
```

### 이미지 최적화
```typescript
import Image from 'next/image'

// 항상 width, height 지정
<Image
  src={src}
  alt={alt}
  width={400}
  height={300}
  className="rounded-lg"
  priority={false} // 중요한 이미지만 true
/>
```

## 보안 가이드라인

### 인증 검증
```typescript
// Server Component에서 인증 확인
async function ProtectedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return <div>Protected content</div>
}
```

### 입력 검증
```typescript
import { z } from 'zod'

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

// 모든 사용자 입력 검증
const validatedData = CreatePostSchema.parse(formData)
```

## 테스트 전략

### 단위 테스트
```typescript
// 컴포넌트 테스트
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

test('renders post title', () => {
  render(<PostCard post={mockPost} />)
  expect(screen.getByText('Test Title')).toBeInTheDocument()
})
```

### E2E 테스트
```typescript
// 주요 플로우 테스트
test('user can create post', async ({ page }) => {
  await page.goto('/login')
  // 로그인 플로우
  await page.goto('/posts/new')
  // 게시물 작성 플로우
})
```

## 배포 및 환경 설정

### 환경 변수
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Next.js
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

### Vercel 설정
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Node.js Version: 18.x

## 개발 워크플로우

### Git 브랜치 전략
- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치
- `fix/*`: 버그 수정 브랜치

### 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드 프로세스 또는 보조 도구 변경
```

## 문제 해결 가이드

### 일반적인 이슈
1. **Hydration 에러**: Server/Client 컴포넌트 경계 확인
2. **RLS 정책 오류**: 정책 조건 및 사용자 권한 확인
3. **캐시 문제**: revalidateTag 또는 revalidatePath 사용
4. **타입 에러**: Supabase 타입 재생성 (`npm run db:types`)

### 디버깅 도구
- Next.js DevTools
- Supabase Dashboard
- Browser DevTools
- Vercel Analytics

이 컨텍스트를 참고하여 일관된 코드 품질과 아키텍처를 유지하며 개발을 진행하세요.