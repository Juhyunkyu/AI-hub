## 프로젝트 운영 룰 (Engineering & Product Rules)

- 문서 버전: v1.0 (초안)
- 최종 업데이트: 2025-08-11
- 적용 범위: 본 리포지토리 전반의 기획/설계/개발/리뷰/배포/운영
- 기술 스택: Next.js (TypeScript), TailwindCSS, shadcn/ui, Lucide, Zustand, Supabase [[참고: 선호 스택 확정]]

## 1) 목표와 범위

- **목표**: AI 정보의 신뢰도 높은 공유·탐색·토론을 위한 웹 허브 구축
- **MVP 범위**: 피드/게시·댓글·리액션·저장·검색·알림·운영(신고)
- **원칙**: 보안(RLS, 최소 권한), 접근성(WCAG AA), 성능(LCP ≤ 2.5s), 유지보수성(가독성 우선)

## 2) 아키텍처 원칙 (Next.js App Router)

- **컴포넌트 모델**: Server Component 기본, Client Component는 상호작용/상태/브라우저 API 필요 시에만
- **데이터 패칭**: 서버 우선(fetch in Server Components/Route Handlers), 클라이언트는 캐시/낙관적 UI에 집중
- **라우트 핸들러(API)**: `app/api/**/route.ts`; 입력/출력 zod 검증, 표준 에러 형식(JSON)
- **서버 액션**: 민감 로직은 서버에서 실행, 클라이언트 비밀 유출 금지
- **런타임**: Edge 런타임는 무상태·저지연 엔드포인트에만 선택적 사용
- **캐싱 전략**: SSG/ISR + 서버 캐시 태그 무효화, 클라 캐시는 Zustand로 국소 관리
- **이미지/에셋**: `next/image`, 최적화/placeholder, 외부 도메인 화이트리스트

## 3) 코드 스타일 & 품질

- **TypeScript**: strict 모드, public API/함수는 명시적 타입, 암시적 any 금지
- **네이밍**: TS/JS는 camelCase, React 컴포넌트는 PascalCase, DB/SQL은 snake_case
- **구조**: 기본적으로 기능 단위(feature-first), UI 컴포넌트는 `components/`, 훅은 `hooks/`
- **불변성**: 상태 업데이트는 불변 유지, 깊은 변경은 헬퍼 사용
- **ESLint/Prettier**: 규칙 위반은 CI에서 차단, 자동 포맷 필수
- **export**: 기본은 named export, default export 지양
- **검증/스키마**: 모든 외부 입력은 zod로 스키마 검증
- **에러 처리**: Result-like 패턴 또는 예외 캡처 + 표준화된 에러 응답(JSON: code/message)

## 4) UI/UX 가이드 (Tailwind + shadcn/ui + Lucide)

- **우선 순위**: shadcn/ui 컴포넌트 우선 사용, 커스텀은 최소화(유틸 클래스로 확장)
- **테마**: 다크 모드 지원, 접근성 대비 준수, 포커스 링 명확화
- **아이콘**: Lucide 고정 사용, 의미/일관성 유지
- **레이아웃**: 반응형 우선, 그리드/스페이싱 시스템 일관화(spacing scale)
- **문서성**: 재사용 컴포넌트는 Props 표준화 및 스토리/문서화(필요 시)

## 5) 상태 관리 (Zustand)

- **설계**: slice 분리(예: auth/feed/post/ui/notification/profile), 컴바인 유틸 사용
- **선택자**: `useStore(selector, shallow)`로 최소 리렌더, 파생 상태는 selector로 계산
- **영속성**: 필요 시 persist, 민감 데이터는 영속 금지
- **패턴**: 낙관적 업데이트 → 실패 시 롤백, 토스트로 피드백

## 6) 데이터베이스 & Supabase

- **DB**: Postgres (Supabase), UUID v7 또는 v4 기본, 타임스탬프는 `timestamptz`
- **스키마 네이밍**: 테이블/컬럼은 snake_case, 집합형 이름은 복수형(예: `posts`)
- **RLS**: 기본 거부(deny-by-default), 필요한 범위만 허용 정책 작성
- **정책**: 공개 콘텐츠는 읽기 최소 범위, 작성/수정/삭제는 소유자·역할 기반
- **마이그레이션**: Supabase CLI 이용, 모든 변경은 SQL migration으로만 반영
- **시드**: 개발 전용 시드 스크립트 분리, 운영 데이터와 분리
- **스토리지**: 이미지/파일은 Storage 버킷, 공개/비공개 버킷 분리 + 정책 적용
- **트리거/인덱스**: 감사 로그/카운터/서브셋 뷰는 트리거로 보완, 쿼리 계획 기반 인덱싱

## 7) 보안/개인정보 보호

- **비밀 관리**: 클라이언트 번들에 비밀 주입 금지, 서버/환경 변수로만 사용
- **인증**: Supabase Auth(OAuth/Email) 사용, JWT 클레임 검증
- **권한**: 역할(`user`, `moderator`, `admin`) 기반, 서버 재검증 필수
- **입력 방어**: XSS 방지(HTML sanitize), CSRF는 상태 변이 API에서 토큰/헤더 검증
- **CSP**: 엄격한 Content-Security-Policy 적용, 외부 리소스 화이트리스트
- **로깅**: 민감 데이터 로깅 금지, PII 최소 수집/보관

## 8) API 설계

- **HTTP 규약**: 상태코드/메서드 정합성 준수, 에러는 표준 형식(JSON)
- **페이징**: 커서 기반 우선(`?cursor=`), 필요 시 정렬키 명시
- **필터/정렬**: 화이트리스트 기반 파라미터, zod 검증
- **버저닝**: 중대한 변경은 URL 네임스페이스 또는 헤더로 버전 관리

## 9) 성능 기준

- **지표**: LCP ≤ 2.5s, TTFB ≤ 0.8s, CLS ≈ 0, JS < 200KB(초기), 이미지 lazy
- **옵티마이즈**: 코드 스플리팅, dynamic import, 유휴 아이콘/유틸 제거
- **캐시**: ISR 주기 명시, 태그 무효화로 부분 갱신

## 10) 접근성(A11y)

- **표준**: WCAG 2.1 AA 지향
- **키보드**: 완전한 탭 이동/포커스 표시
- **ARIA**: 의미 요소 + 적절한 ARIA 속성 사용
- **콘트라스트**: 텍스트 대비 기준 충족

## 11) 테스트 전략

- **유닛/훅/유틸**: Vitest/Jest + Testing Library
- **컴포넌트**: Storybook/Playground 기반 상호검증(선택), 시각 회귀는 필요 시
- **E2E**: Playwright (주요 플로우: 로그인/게시/댓글/검색)
- **DB**: 마이그레이션 검증을 위한 샤도우 DB
- **CI 게이트**: 빌드/린트/테스트/타입체크 통과 필수

## 12) Git 워크플로/코드리뷰

- **전략**: 트렁크 기반 + 단수 피처 브랜치, 짧은 생명 주기
- **브랜치 네이밍**: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`
- **커밋 규칙**: Conventional Commits (scope 권장), 의미 있는 최소 단위
- **PR 룰**: 설명/체크리스트/테스트 증빙, 1+ 리뷰 승인, 스스로 머지 금지(예외: 긴급 패치)

## 13) CI/CD & 배포

- **프리뷰**: PR마다 미리보기 배포(예: Vercel)
- **마이그레이션**: 배포 전/후 순서 엄수, 롤백 스크립트 포함 권장
- **시크릿**: CI 시크릿 관리(환경별 분리), `.env`는 저장 금지, `env.example` 제공

## 14) 환경/설정

- **환경 분리**: `local` / `staging` / `production`
- **환경 변수**: `NEXT_PUBLIC_` 접두사는 공개 가능 항목만, 나머지는 서버 전용
- **피처 플래그**: 환경/사용자 그룹 단위 플래그로 점진적 출시

## 15) 관측 가능성(Observability)

- **에러 추적**: Sentry 등 도입 고려, 릴리즈 태깅
- **모니터링**: 성능 지표/에러율/알림 파이프라인 구성
- **감사 로그**: 주요 변이/권한 이벤트 기록(별도 테이블)

## 16) 콘텐츠 정책/운영

- **신고**: 신고 사유/상태 트래킹, SLA 내 처리
- **모더레이션**: 가이드라인 기준 일관 처리, 블록/제한 정책 문서화
- **저작권**: 출처 명시와 링크, 삭제 요청 프로세스

## 17) Definition of Ready / Done

- **DoR**: 요구사항 명확, 수용 기준(AC) 정의, 데이터/권한/UI 시나리오 합의, 리스크 파악
- **DoD**: 빌드·테스트·타입·린트 통과, 접근성/성능 체크, 문서/체인지로그/마이그레이션 포함, 리뷰 승인/배포

## 18) 결정 기록(ADR)

- 아키텍처/정책의 중대한 변경은 `docs/adr/ADR-YYYYMMDD-슬러그.md`로 기록

## 19) 라이선스/서드파티

- OSS 라이선스 준수, 폰트/아이콘/이미지 출처 명시, 취약점 업데이트 주기적 반영

## 20) 파일/디렉터리 기본 합의 (초기화 시 적용)

- `app/` App Router 구조
- `components/` 재사용 UI
- `features/*` 기능 단위 UI/로직 묶음
- `lib/` 유틸/클라이언트(SDK 래퍼, `supabase` 클라이언트 팩토리 등)
- `store/` Zustand slices
- `styles/` Tailwind 설정/글로벌 CSS
- `types/` 공유 타입과 zod 스키마
- `docs/` 문서(PRD, ADR, 운영 가이드)

## 21) 스키마/마이그레이션 룰(요약)

- 파일명: `YYYYMMDDHHMM__snake_case_description.sql`
- 포함: DDL + 관련 정책(RLS) + 인덱스 + 뷰/트리거
- 롤백: 가능한 경우 `-- down` 블록 제공
- 리뷰: PR에서 쿼리 계획/인덱스 근거 간단 메모

## 22) 이후 절차

1. 본 문서 합의 후, `env.example`/초기 프로젝트 템플릿/기본 Supabase 스키마 및 RLS 정책/ERD 산출
2. CI 기본 파이프라인(빌드/타입/린트/테스트)과 PR 템플릿 추가
