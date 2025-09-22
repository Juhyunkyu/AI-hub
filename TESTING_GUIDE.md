# 🧪 Team Hub 테스트 환경 가이드

**프로젝트**: AI 지식 교류 허브
**테스트 프레임워크**: Vitest 3.2.4 + React Testing Library 16.3.0
**설정 완료일**: 2025년 1월

---

## 📋 테스트 환경 구성 요약

### ✅ 완료된 설정

1. **최신 테스트 스택** (React 19 호환)
   - Vitest 3.2.4 (TypeScript 네이티브)
   - React Testing Library 16.3.0
   - MSW 2.11.2 (API 모킹)
   - Jest-DOM 매처
   - Coverage 리포팅 (v8)

2. **80% 커버리지 목표 설정**
   - Branches: 80%
   - Functions: 80%
   - Lines: 80%
   - Statements: 80%

3. **완전한 모킹 환경**
   - Supabase 클라이언트 모킹
   - Next.js Router 모킹
   - Browser APIs 모킹 (ResizeObserver, IntersectionObserver)
   - SSR 호환성 확보

---

## 🚀 테스트 명령어

```bash
# 모든 테스트 실행
npm run test

# 단일 실행 (CI용)
npm run test:run

# 커버리지 포함 실행
npm run test:coverage

# 감시 모드 (개발용)
npm run test:watch

# UI 모드
npm run test:ui

# 커버리지 UI 모드
npm run test:coverage:ui

# E2E 테스트 (Playwright)
npm run test:e2e
```

---

## 📁 테스트 파일 구조

```
src/
├── components/
│   └── auth/
│       ├── social-buttons.tsx
│       └── __tests__/
│           └── social-buttons.test.tsx  ✅ 15개 테스트
├── hooks/
│   ├── use-chat.ts
│   └── __tests__/
│       └── use-chat.test.ts             ✅ 15개 테스트 (일부 수정 필요)
tests/
├── setup.ts                            ✅ 완전한 모킹 설정
├── utils/
│   └── test-utils.tsx                   ✅ 커스텀 렌더 함수
└── mocks/
    └── handlers.ts                      ✅ MSW API 핸들러
```

---

## 🔧 설정 파일 설명

### `vitest.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      threshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } }
    },
    alias: { '@': resolve(__dirname, './src') }
  }
})
```

### `tests/setup.ts`
- Supabase 클라이언트 완전 모킹
- Next.js router 모킹
- Browser APIs 모킹
- MSW 서버 설정
- 테스트 데이터 제공

### `tests/utils/test-utils.tsx`
- QueryClient Provider 래퍼
- ThemeProvider 래퍼
- 커스텀 render 함수
- 유용한 헬퍼 함수들

---

## 📊 현재 테스트 현황

### ✅ 작동하는 테스트
- **SocialButtons**: 15개 테스트 모두 통과
  - 렌더링 테스트
  - OAuth 로그인 기능
  - 에러 처리
  - 접근성 검증
  - 반응형 레이아웃

### ⚠️ 수정 필요한 테스트
- **use-chat 훅**: 6개 테스트 실패 (API 경로 불일치)
  - MSW 핸들러와 훅의 API 경로 매칭 필요
  - 테스트 데이터 구조 조정 필요

---

## 🎯 테스트 작성 가이드

### 1. 컴포넌트 테스트
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { YourComponent } from '../your-component'

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

### 2. 훅 테스트
```typescript
import { renderHook, act } from '@testing-library/react'
import { useYourHook } from '../use-your-hook'

describe('useYourHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useYourHook())
    expect(result.current.loading).toBe(false)
  })
})
```

### 3. API 모킹
```typescript
import { server } from '../../../tests/setup'
import { http, HttpResponse } from 'msw'

// 특정 테스트용 핸들러 추가
server.use(
  http.get('/api/your-endpoint', () => {
    return HttpResponse.json({ data: 'test' })
  })
)
```

---

## 🚨 알려진 이슈 및 해결 방법

### 1. MSW 핸들러 경로 불일치
**문제**: 실제 API 경로와 MSW 핸들러 경로가 다름
**해결**: `tests/mocks/handlers.ts`에서 올바른 경로 설정

### 2. React 19 호환성
**해결됨**: React Testing Library 16.3.0 사용으로 완전 호환

### 3. TypeScript 타입 이슈
**해결됨**: Vitest 네이티브 TypeScript 지원으로 해결

---

## 📈 다음 단계

### 즉시 실행
1. **use-chat 테스트 수정**: API 경로 매칭 완료
2. **추가 컴포넌트 테스트**: 게시물, 프로필 컴포넌트 테스트
3. **통합 테스트**: 페이지 레벨 테스트 추가

### 단기 목표 (1-2주)
1. **80% 커버리지 달성**
2. **E2E 테스트 확장**
3. **성능 테스트 도입**

### 중기 목표 (1개월)
1. **Visual Regression Testing**
2. **Accessibility Testing 자동화**
3. **Load Testing**

---

## 🔗 관련 링크

- [Vitest 공식 문서](https://vitest.dev/)
- [React Testing Library 가이드](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW 문서](https://mswjs.io/)
- [Jest-DOM 매처](https://github.com/testing-library/jest-dom)

---

## 👥 기여 가이드

새로운 테스트 작성 시:
1. 컴포넌트와 같은 폴더에 `__tests__` 디렉토리 생성
2. `.test.tsx` 또는 `.test.ts` 확장자 사용
3. 의미있는 테스트 그룹과 설명 작성
4. 모킹이 필요한 경우 `tests/setup.ts` 확인
5. 커버리지 80% 목표 유지

**Happy Testing! 🎉**