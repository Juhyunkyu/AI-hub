# 시스템 아키텍처 및 프로젝트 구조

**문서 업데이트**: 2025-10-04

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│           Client (Browser)                       │
│  Next.js 15 + React 19 + TailwindCSS            │
│  ┌──────────────┐  ┌───────────────┐            │
│  │  UI Layer    │  │  State Layer  │            │
│  │  shadcn/ui   │  │  Zustand      │            │
│  └──────────────┘  └───────────────┘            │
└──────────────┬──────────────────────────────────┘
               │ HTTP/WebSocket
┌──────────────┴──────────────────────────────────┐
│           Next.js API Routes                     │
│  ┌──────────────────────────────────┐            │
│  │  /api/posts    /api/chat         │            │
│  │  /api/auth     /api/admin        │            │
│  └──────────────┬───────────────────┘            │
└─────────────────┼───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│           Supabase Cloud                         │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ PostgreSQL │  │  Auth    │  │  Storage    │ │
│  └────────────┘  └──────────┘  └─────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │       Realtime (WebSocket)                 │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 프로젝트 구조

### 핵심 디렉토리

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 페이지 그룹
│   ├── admin-panel/              # 관리자 대시보드
│   ├── api/                      # API Routes
│   ├── chat/                     # 채팅 페이지
│   ├── posts/                    # 게시물 페이지
│   ├── profile/                  # 프로필 페이지
│   └── settings/                 # 설정 페이지
│
├── components/                   # React 컴포넌트
│   ├── ui/                       # shadcn/ui 기본 컴포넌트 (25+)
│   ├── chat/                     # 채팅 컴포넌트
│   ├── upload/                   # 파일 업로드 시스템
│   ├── map/                      # 지도 컴포넌트
│   ├── shared/                   # 공유 컴포넌트
│   ├── post/                     # 게시물 컴포넌트
│   ├── profile/                  # 프로필 컴포넌트
│   └── admin/                    # 관리자 컴포넌트
│
├── hooks/                        # 커스텀 훅 (13개)
│   ├── use-chat.ts
│   ├── use-realtime-chat.ts
│   └── ...
│
├── lib/                          # 유틸리티 라이브러리
│   ├── supabase/                 # Supabase 클라이언트
│   ├── repositories/             # 데이터 레포지토리 패턴
│   ├── schemas/                  # Zod 스키마 (타입 검증)
│   └── utils/                    # 헬퍼 함수
│
├── stores/                       # Zustand 상태 관리
│   ├── auth.ts
│   ├── ui.ts
│   └── ...
│
└── types/                        # TypeScript 타입
    ├── supabase.ts
    ├── chat.ts
    └── ...
```

### API Routes 구조

```
src/app/api/
├── posts/                        # 게시물 API
├── chat/                         # 채팅 API
│   ├── messages/                 # 메시지 CRUD
│   ├── rooms/                    # 채팅방 관리
│   ├── typing/                   # 타이핑 인디케이터
│   ├── read/                     # 읽음 상태
│   └── files/                    # 파일 업로드
├── comments/                     # 댓글 API
├── auth/                         # 인증 API
├── users/                        # 사용자 API
└── admin/                        # 관리자 API
```

### 컴포넌트 계층 구조

```
components/
├── ui/                           # 기본 UI 컴포넌트
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   └── ...
│
├── chat/                         # 채팅 시스템
│   ├── chat-layout.tsx           # 메인 레이아웃
│   ├── virtualized/              # 가상화 메시지
│   │   ├── VirtualizedMessageList.tsx
│   │   └── MessageRenderer.tsx
│   └── modals/                   # 채팅 모달
│
├── upload/                       # 업로드 시스템
│   ├── chat-attachment-menu.tsx  # 메인 메뉴
│   ├── gallery-option.tsx
│   ├── camera-option.tsx
│   ├── file-option.tsx
│   └── location-option.tsx
│
└── shared/                       # 공유 컴포넌트
    ├── image-lightbox.tsx        # 라이트박스 (편집 포함)
    └── toolbar-items/            # 편집 툴바 (3단계)
        ├── base-toolbar.tsx
        ├── edit-toolbar.tsx
        └── pen-toolbar.tsx
```

---

## 아키텍처 원칙

### 1. Server/Client Component 분리
- **Server Components**: 데이터 페칭, SEO
- **Client Components**: 인터랙션, 상태 관리 ("use client")

### 2. Repository 패턴
- 데이터 접근 로직 중앙화 (`lib/repositories/`)
- 재사용 가능한 쿼리
- 타입 안정성 보장

### 3. Custom Hook 분리
- UI 로직과 비즈니스 로직 분리
- 재사용성 증가
- 테스트 용이성

### 4. 타입 안정성
- Supabase 타입 자동 생성
- Zod 스키마로 런타임 검증
- TypeScript strict 모드

---

## 성능 최적화 전략

### 1. Next.js 15 최적화
- Turbopack 번들러
- React 19 Compiler
- Package Import 최적화

### 2. React 최적화
- React.memo
- useMemo, useCallback
- @tanstack/react-virtual

### 3. 번들 최적화
- Dynamic Import
- Code Splitting
- Tree Shaking

---

[← 메인으로](../CLAUDE.md) | [채팅 시스템 →](CHAT_SYSTEM.md)
