# AI 지식 교류 허브 - Team Hub

**문서 최종 업데이트**: 2025-10-04
**프로젝트 버전**: v0.8
**기술 스택**: Next.js 15.4.6, React 19.1.0, TypeScript 5, Supabase

---

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [빠른 시작](#빠른-시작)
- [기술 스택](#기술-스택)
- [주요 기능](#주요-기능)
- [상세 문서](#상세-문서)

---

## 프로젝트 개요

### 🎯 제품 정의
- **프로젝트명**: AI 지식 교류 허브 (Team Hub)
- **목적**: AI 관련 정보의 신뢰도 높은 공유·탐색·토론을 위한 웹 플랫폼
- **핵심 가치**: 신뢰성, 속도, 참여, 재사용성
- **대상 사용자**: Creator, Learner, Curator, Organizer, Moderator, Admin

### 📊 프로젝트 상태
- **총 파일 수**: 150+ TypeScript/React 파일
- **컴포넌트 수**: 90+ 재사용 가능 컴포넌트
- **커스텀 훅**: 13개 전문화된 훅
- **API Routes**: 25+ RESTful 엔드포인트

---

## 빠른 시작

```bash
# 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

### 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_KAKAO_MAPS_APP_KEY=your_kakao_key
```

---

## 기술 스택

### Frontend
- **Framework**: Next.js 15.4.6 (App Router, Turbopack)
- **Runtime**: React 19.1.0 (with React Compiler)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: TailwindCSS 4
- **UI Library**: shadcn/ui + Radix UI
- **State Management**: Zustand 5.0.7
- **Data Fetching**: TanStack Query (React Query)

### Backend
- **Database**: Supabase (PostgreSQL 15)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime (WebSocket)

### 특수 라이브러리
- **Canvas Drawing**: react-konva 19.0.10
- **Security**: isomorphic-dompurify
- **Virtualization**: @tanstack/react-virtual

---

## 주요 기능

### ✅ 완료된 핵심 기능

#### 🔐 인증 시스템
- 소셜 로그인 (Google, GitHub, Kakao, Naver)
- 이메일 회원가입/로그인
- 프로필 관리
- 역할 기반 권한 제어

#### 📝 게시물 시스템
- 게시물 CRUD
- HTML 콘텐츠 지원 (리치 에디터)
- 이미지 업로드 및 최적화
- 공지사항 핀 고정
- 검색 및 카테고리 시스템

#### 💬 채팅 시스템
- 실시간 1:1 DM 및 그룹 채팅
- 타이핑 인디케이터
- 메시지 가상화 (성능 최적화)
- 파일 업로드 (이미지/파일/위치)
- 이미지 편집 (펜 그리기, 필터 등)
- 위치 공유 (카카오맵 통합)
- 읽음 표시

#### 👨‍💼 관리자 시스템
- 대시보드 (통계, 차트)
- 사용자/게시물/댓글 관리
- 성능 모니터링

---

## 상세 문서

프로젝트의 각 영역에 대한 자세한 정보는 다음 문서를 참조하세요:

- **[아키텍처](docs/ARCHITECTURE.md)** - 시스템 아키텍처, 프로젝트 구조
- **[채팅 시스템](docs/CHAT_SYSTEM.md)** - 채팅 시스템 상세 구현
- **[기능 상세](docs/FEATURES.md)** - 구현 현황 및 기능 설명
- **[데이터베이스](docs/DATABASE.md)** - DB 설계, ERD, RLS 정책
- **[문제 해결](docs/TROUBLESHOOTING.md)** - 알려진 문제점 및 해결 방안
- **[개발 가이드](docs/DEVELOPMENT.md)** - 코드 스타일, 보안 가이드라인
- **[로드맵](docs/ROADMAP.md)** - 향후 개발 계획

---

## 📞 추가 정보

### 관련 문서
- `.cursor_rules`: AI 코딩 어시스턴트 규칙
- `package.json`: 의존성 및 스크립트
- `next.config.ts`: Next.js 설정
- `supabase/`: 데이터베이스 마이그레이션

### 팀 커뮤니케이션
- **이슈 트래킹**: GitHub Issues
- **코드 리뷰**: Pull Request 기반

---

## 📝 최근 업데이트

- **v0.8 (2025-10-04)**: 펜 툴바 "전체 지우기" 버튼 완전 수정
- **v0.7 (2025-10-03)**: 이미지 편집 툴바 버그 수정
- **v0.6 (2025-10-02)**: DOMPurify XSS 보안 강화
- **v0.5 (2025-10-02)**: 이미지 펜 그리기 및 편집 기능 완성

상세한 변경 내역은 각 문서의 히스토리 섹션을 참조하세요.

---

*이 문서는 AI 지식 교류 허브 프로젝트의 메인 문서입니다.*
