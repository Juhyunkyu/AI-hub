# 개발 가이드라인

**문서 업데이트**: 2025-10-04

---

## 코드 스타일

### TypeScript 설정

```json
{
  "strict": true,
  "noEmit": true,
  "verbatimModuleSyntax": true
}
```

### 네이밍 규칙

- **컴포넌트**: PascalCase (`UserAvatar`)
- **함수/변수**: camelCase (`getUserData`)
- **상수**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **파일**: kebab-case (`user-avatar.tsx`)

### 컴포넌트 작성 패턴

```typescript
interface ComponentProps {
  // Props 타입 정의
}

export function Component({ prop }: ComponentProps) {
  // 1. 상태 관리
  // 2. 이벤트 핸들러
  // 3. JSX 반환
}
```

### 훅 작성 패턴

```typescript
export function useCustomHook() {
  // 1. 내부 상태
  // 2. useEffect 등
  // 3. 반환값
  return { data, loading, error };
}
```

---

## 아키텍처 원칙

### 1. Server/Client Component 분리

- **Server Component**: 데이터 페칭, SEO
- **Client Component**: 인터랙션 ("use client")

### 2. Repository 패턴

- 데이터 접근 로직은 `lib/repositories/`에 집중
- 재사용 가능한 쿼리

### 3. Custom Hook 분리

- UI 로직과 비즈니스 로직 분리
- 재사용성 증가

### 4. 타입 안정성

- Supabase 타입 자동 생성
- Zod 스키마로 런타임 검증

---

## 보안 가이드라인

### 1. RLS (Row Level Security) 필수

```sql
-- 모든 테이블에 RLS 활성화
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- auth.uid()로 사용자 확인
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
```

### 2. 입력 검증

```typescript
// Zod 스키마로 서버 사이드 검증
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// 클라이언트 검증은 UX용
```

### 3. XSS 방지

```typescript
// DOMPurify로 HTML sanitize
import { sanitizePostContent } from "@/lib/sanitize";

const sanitizedHtml = sanitizePostContent(userInput);
```

### 4. CSRF 방지

- Supabase Auth 토큰 사용
- Same-Site Cookie

### 5. 파일 업로드 보안

```typescript
// MIME 타입 검증
if (!file.type.startsWith('image/')) {
  throw new Error('Invalid file type');
}

// 파일 크기 제한
if (file.size > 5 * 1024 * 1024) {
  throw new Error('File too large');
}

// Storage RLS 정책
```

---

## 성능 최적화

### Next.js 15 최적화

- Turbopack 번들러
- React 19 Compiler
- Package Import 최적화

### React 최적화

```typescript
// React.memo
const Component = memo(ComponentBase, arePropsEqual);

// useMemo, useCallback
const value = useMemo(() => expensiveCalc(), [dep]);
const callback = useCallback(() => {}, [dep]);

// @tanstack/react-virtual
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50
});
```

### 이미지 최적화

```typescript
// Next.js Image
<Image
  src={url}
  alt="description"
  width={300}
  height={200}
  loading="lazy"
  placeholder="blur"
  quality={85}
/>
```

---

## 테스트

### 단위 테스트 (Vitest)

```typescript
import { describe, it, expect } from 'vitest';

describe('Component', () => {
  it('should render', () => {
    expect(true).toBe(true);
  });
});
```

### E2E 테스트 (Playwright)

```typescript
test('should login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
});
```

---

## Git 워크플로우

### 브랜치 전략

- `main`: 프로덕션
- `develop`: 개발
- `feature/*`: 기능 개발
- `hotfix/*`: 긴급 수정

### 커밋 메시지

```
feat: Add chat message editing
fix: Fix image upload bug
docs: Update README
refactor: Simplify auth logic
test: Add chat system tests
```

---

## 배포 및 운영

### 배포 환경

- **Platform**: Vercel (권장)
- **Database**: Supabase Cloud
- **CDN**: Vercel Edge Network
- **Storage**: Supabase Storage

### 환경 변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
NEXT_PUBLIC_KAKAO_MAPS_APP_KEY=your_kakao_key
```

### 모니터링

- **에러 추적**: Sentry (권장)
- **성능 지표**: Vercel Analytics
- **Web Vitals**: 커스텀 모니터링

---

[← 문제 해결](TROUBLESHOOTING.md) | [로드맵 →](ROADMAP.md)
