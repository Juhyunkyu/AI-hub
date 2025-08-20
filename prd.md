## AI 지식 교류/공유 허브 PRD (Product Requirements Document)

- 문서 버전: v0.2 (구현 진행 중)
- 최종 업데이트: 2025-08-17
- 문서 작성: 팀
- 대상 플랫폼: 웹 (Desktop-first, Responsive)
- 프레임워크: Next.js (TypeScript)
- 스타일: TailwindCSS
- UI 구성 요소: shadcn/ui
- 아이콘: Lucide
- 상태 관리: Zustand
- 권장 백엔드/인증/데이터: Supabase (권장; 확정 전)

## 1) 제품 개요

- **문제 정의**: AI 관련 정보는 급변하며 산재되어 있고, 큐레이션/토론/실전 활용 맥락이 약함. 신뢰 가능한 출처 기반의 공유와 실시간 교류가 어려움.
- **해결 가설**: 신뢰 가능한 출처 기반의 게시/큐레이션, 실시간 교류(코멘트/스페이스/이벤트), 맞춤 피드, 검색/태그 체계를 제공하는 허브.
- **제품 한줄 설명**: 최신 AI 정보 공유·토론·실험을 한곳에서 빠르게 연결하는 커뮤니티 허브.
- **핵심 가치**: 신뢰성, 속도(탐색/정리), 참여(교류/실험), 재사용(북마크/콜렉션).

## 2) 목표와 비목표

- **목표 (MVP)**
  - 최신 AI 콘텐츠(뉴스/논문/글/도구) 게시·태그·토론 기능 제공
  - 신뢰·품질을 높이는 리액션/저장/팔로우/신고 체계
  - 빠른 검색/필터(주제/태그/출처)와 개인화된 기본 피드
  - 가벼운 실시간 상호작용(댓글, 알림)
- **비목표 (MVP 범위 외)**
  - 유료 결제/구독 모델
  - 복잡한 실시간 대규모 라이브 스트리밍
  - 엔터프라이즈 SSO/조직별 권한 관리

## 3) 주요 성과 지표(북극성 지표/서브 지표)

- **북극성 지표**: 주간 활성 기여자 수(WAC: Weekly Active Contributors)
- **서브 지표**
  - 주간 신규 게시물 수, 주간 코멘트 수
  - 게시물당 평균 체류 시간, 저장/공유율
  - 검색 성공률(검색 후 클릭율), 재방문율(D7, D30)
  - 신고 처리 리드타임, 콘텐츠 승인 리드타임(운영 관점)
  - 쪽지 교환 수, 팔로우 관계 형성 수
  - 사용자 프로필 완성도, 이미지 업로드율

### 📊 현재 구현된 지표 추적

- **사용자 활동**: 로그인, 게시물 작성, 댓글 작성, 쪽지 교환
- **상호작용**: 좋아요, 저장, 팔로우, 신고
- **시스템 성능**: 페이지 로드 시간, API 응답 시간, 에러율

## 4) 사용자 및 페르소나

- **Creator(창작자/발행자)**: 출처를 명확히 한 글/링크/요약을 게시하고 피드백을 받음
- **Learner(학습자)**: 최신 흐름을 빠르게 파악하고 북마크/요약을 통해 학습
- **Curator(큐레이터)**: 주제별로 좋은 자료를 모아 태깅/콜렉션으로 공유
- **Organizer(행사/스페이스 주최자)**: 소규모 이벤트/스페이스를 개설하고 관심사를 모음
- **Moderator/Admin**: 신고/스팸 관리, 태그/주제 정리, 공지 배포

## 5) 핵심 사용 시나리오 (User Stories)

- **게시/공유**
  - 사용자는 링크/파일/텍스트로 게시물을 등록한다
  - 사용자는 제목, 설명, 출처, 태그(다중)와 주제를 설정한다
- **탐색/학습**
  - 사용자는 홈 피드/주제별 피드/검색을 통해 최신 콘텐츠를 발견한다
  - 사용자는 저장/좋아요/공유로 신호를 남기고 추후 재방문한다
- **토론/교류**
  - 사용자는 댓글로 토론하고, 멘션(@)과 알림을 통해 소통한다
  - 사용자는 팔로우를 통해 작성자/태그/주제 업데이트를 받는다
- **운영/신뢰성**
  - 사용자는 부적절한 콘텐츠를 신고할 수 있고 운영자는 처리한다
  - 운영자는 공지를 게시하고 태그/주제를 관리한다

## 6) 정보 구조(IA) 및 내비게이션

- **사이트맵 (1차)**
  - `/` 홈 피드
  - `/feed` 전체/팔로잉/추천 탭
  - `/topics` 주제 목록 → `/topics/[slug]`
  - `/posts/[id]` 게시물 상세
  - `/search` 검색(키워드, 태그, 주제, 출처 필터)
  - `/collections` 내 저장/콜렉션 → `/collections/[id]`
  - `/events` 이벤트/스페이스 → `/events/[id]`
  - `/profile/[username]` 프로필(게시물/활동/콜렉션)
  - `/settings` 계정/알림/연동
  - `/admin` 운영(권한 제한)

## 7) 기능 요구사항 (MVP)

- **계정/프로필**: 이메일/소셜 로그인, 프로필 편집, 팔로우, 알림 설정
- **게시물**: 작성/수정/삭제, 링크/텍스트/파일, 태그·주제, 출처(원문 링크), 썸네일
- **댓글**: 작성/수정/삭제, 멘션(@), 신고
- **리액션/저장**: 좋아요, 북마크(콜렉션에 추가), 공유 링크 생성
- **검색/탐색**: 키워드, 태그/주제/출처 필터, 정렬(최신/인기)
- **알림**: 댓글/멘션/팔로잉 업데이트/운영 공지
- **운영/신고**: 콘텐츠 신고/처리, 공지 발행(역할 기반 권한)

## 8) 비기능 요구사항

- **성능**: LCP ≤ 2.5s(데스크톱 기준), 이미지 최적화, incremental static regeneration 활용
- **접근성**: WCAG 2.1 AA 지향, 키보드 내비, 콘트라스트, ARIA 준수
- **보안/개인정보**: OAuth/OpenID, RLS(백엔드 선택 시), XSS/CSRF 방지, 비공개 정보 최소화
- **SEO/공유**: app/metadata, OG/Twitter 카드, 구조화 데이터(게시물)
- **가용성**: 에러 경계, 로깅/모니터링, 점진적 향상

## 9) 기술 아키텍처(프런트엔드 중심)

- **Next.js (TypeScript)**: App Router, Server/Client Component 혼합, Route Handlers(API)
- **상태 관리: Zustand**
  - `authSlice`: 사용자/세션/권한
  - `uiSlice`: 모달/토스트/테마
  - `feedSlice`: 피드 필터/페이지네이션/정렬
  - `postSlice`: 작성/수정/상세 캐시
  - `profileSlice`: 사용자 데이터/팔로우
  - `notificationSlice`: 알림 목록/읽음 처리
- **UI: shadcn/ui + Lucide**
  - 버튼/입력/다이얼로그/토스트/탭/드롭다운/아바타/스켈레톤/배지/토글 등
  - Lucide 아이콘으로 일관된 시각 언어 구성
- **스타일: TailwindCSS**
  - 디자인 토큰(색, 간격, 타이포), 다크모드 지원, `cn` 유틸
- **데이터/백엔드 (권장: Supabase)**
  - 인증(Auth), Postgres, RLS, Storage(이미지/파일), Realtime(댓글/알림), Edge Functions(후처리)
  - 백엔드 미확정 시 API 모킹으로 프런트 병행 개발

## 10) 데이터 모델 (초안)

- `User`: id, email, username, createdAt, updatedAt
- `Profile`: userId(FK), bio, avatarUrl, links(jsonb)
- `Topic`: id, slug, name, description
- `Tag`: id, name, slug
- `Post`: id, authorId(FK), title, content(md/rtf), url(optional), source(원문), thumbnail, topics[], tags[], createdAt, updatedAt, status
- `Comment`: id, postId(FK), authorId(FK), body, parentId, createdAt, updatedAt, status
- `Reaction`: id, targetType(post/comment), targetId, userId, type(like), createdAt
- `Collection`: id, ownerId, name, description, isPublic, createdAt
- `CollectionItem`: collectionId, postId, addedAt
- `Follow`: followerId, followingUserId | topicId | tagId, createdAt
- `Notification`: id, userId, type, payload(jsonb), isRead, createdAt
- `Report`: id, targetType, targetId, reporterId, reason, status, createdAt, resolvedAt

## 11) 화면/페이지(대표 컴포넌트 매핑)

- **홈/피드**: Tabs, Card, Skeleton, Pagination, DropdownMenu, Badge
- **게시물 작성**: Form, Input, Textarea/Editor, Combobox(태그/주제), Dialog(미리보기)
- **상세/댓글**: Card, Separator, Avatar, ScrollArea, Tooltip, Button, Menubar
- **검색**: Command/Combobox, Badge(필터), Tabs(정렬)
- **프로필**: Avatar, Tabs, DataTable(활동), Badge
- **설정**: Form, Switch, Select, AlertDialog(위험 작업)
- **알림**: Popover/Sheet, List, Button(일괄 읽음)
- **운영**: DataTable, Select, AlertDialog(처리), Badge(상태)

## 12) 상호작용 흐름 (요약)

- **게시 흐름**: 작성 → 유효성 검증 → 미리보기 → 게시 → 피드 업데이트/알림 발생
- **댓글 흐름**: 입력 → 낙관적 업데이트(Zustand) → 서버 반영/실패 시 롤백
- **팔로우/리액션**: 즉시 반영(낙관적) → 실패 시 토스트 + 롤백
- **검색**: 입력 디바운스 → 서버 질의 → 결과/필터 조합 유지
- **알림**: 새 이벤트 수신 → 토스트/배지 → 읽음 처리 API

## 13) 라우팅 구조 (App Router 초안)

```
app/
  (marketing)/
    page.tsx
  (main)/
    layout.tsx
    page.tsx                  // 홈 피드
    feed/page.tsx
    topics/page.tsx
    topics/[slug]/page.tsx
    posts/[id]/page.tsx
    search/page.tsx
    collections/page.tsx
    collections/[id]/page.tsx
    events/page.tsx
    events/[id]/page.tsx
    profile/[username]/page.tsx
    settings/page.tsx
    admin/page.tsx
  api/
    posts/route.ts            // CRUD (권장: 백엔드 확정 시 교체)
    comments/route.ts
    reactions/route.ts
    follow/route.ts
    notifications/route.ts
```

## 14) 상태 관리 설계 (Zustand 초안)

- **스토어 구조**
  - `useAuthStore`: user, session, isLoading, signIn/signOut
  - `useUIStore`: theme, modals, toasts
  - `useFeedStore`: filters(sort, topic, tags), items, pagination, fetchNext
  - `usePostStore`: draft, currentPost, create/update/delete
  - `useProfileStore`: profile, follows, updateProfile
  - `useNotificationStore`: items, unreadCount, markAsRead
- **패턴**: slice 분리, persist(필요 시), immutable 업데이트, optimistic UI, error boundary + 토스트

## 15) 디자인 가이드 (요약)

- Tailwind 디자인 토큰 기반: spacing, color, typography
- 다크모드 기본 제공, 명확한 포커스 링, 키보드 탐색 고려
- shadcn/ui 프리셋 우선 사용, 커스텀은 유틸 클래스로 최소화

## 16) 성능/품질/테스트

- Code-splitting, 이미지 최적화, `next/image` 우선
- 캐시 전략: SSG + ISR + 클라이언트 캐시(Zustand)
- 기본 테스트: 유닛(스토어/유틸), 라우팅/렌더 스냅샷, 접근성/링크 무결성

## 17) 분석/로그

- 기본 이벤트: view_post, create_post, add_comment, follow, reaction, save_to_collection, search
- 알림/에러 로깅: 중요 경로(게시/댓글/알림) 실패 수집

## 18) 보안/권한

- 인증 필요 경로 보호(작성/댓글/저장/팔로우/알림)
- 역할: user, moderator, admin
- 신고/운영 페이지는 역할 제한 및 감사 로그 필요

## 19) 롤아웃 계획 (MVP)

### ✅ 완료된 단계 (2025-08-17 기준)

- **주차 1-2**: ✅ IA/디자인 시스템 정립, 인증/프로필, 피드/게시물 리스트
- **주차 3-4**: ✅ 게시/댓글/리액션/저장, 검색/필터, 쪽지 시스템
- **주차 5**: ✅ 운영/신고, 접근성/성능 튜닝, 관리자 시스템

### 🔄 현재 진행 중

- **주차 6**: 알림 시스템 완성, 태그/주제 시스템 구현, 콜렉션 시스템

### 📋 남은 작업

- **주차 7**: 클로즈드 베타(50~100명) → 버그픽스 → 퍼블릭 베타
- **주차 8**: 사용자 피드백 반영, 성능 최적화, SEO 개선

## 20) 리스크 및 대응

- 콘텐츠 품질 확산 리스크 → 신고/모더레이션/가이드 강화
- 스팸/봇 → 레이트리밋/지연 게시/신뢰 점수
- 급격한 트래픽 변화 → CDN/ISR 전략, 단순한 확장 포인트(백엔드 독립성)
- 피드 개인화 과도 복잡성 → MVP는 규칙 기반 + 간단한 가중치로 시작

## 21) 이후 로드맵(비-MVP)

- 고급 개인화(추천), 크로스 플랫폼 앱, 조직/팀 공간, 유료 구독/후원, 고급 실시간 스페이스, AI 요약/태깅/추천 자동화, 벡터 검색

## 22) 구현 현황 (2025-08-17 기준)

### ✅ 완료된 기능

#### **인증 및 사용자 관리**

- **소셜 로그인**: Google, GitHub OAuth 연동
- **이메일 로그인**: 이메일/비밀번호 회원가입 및 로그인
- **사용자 프로필**: username, bio, avatar 설정
- **프로필 이미지**: 업로드, 압축(5MB 제한), 정사각형 크롭
- **사용자 설정**: 다크모드, 비밀번호 변경(이메일 로그인만)
- **사용자 경험**: 로그인 후 이전 페이지로 리다이렉트, 사용자 친화적 에러 메시지

#### **관리자 시스템**

- **관리자 권한**: role 기반 접근 제어
- **관리자 대시보드**: 통계, 최근 사용자/게시물/댓글
- **사용자 관리**: 목록 조회, 검색, 필터링, 페이지네이션
- **게시물 관리**: 목록 조회, 검색, 필터링
- **댓글 관리**: 목록 조회, 검색, 필터링
- **사이트 설정**: 기본 설정 페이지 (구현 준비)

#### **게시물 시스템**

- **게시물 작성**: 제목, 내용, HTML 지원
- **게시물 조회**: 목록, 상세, 작성자 정보
- **게시물 상호작용**: 좋아요, 저장, 신고
- **피드 시스템**: 최신순 정렬, 무한 스크롤
- **게시물 검색**: 제목/내용 기반 검색

#### **댓글 시스템**

- **댓글 작성**: 게시물별 댓글 작성
- **댓글 수정/삭제**: 작성자만 수정/삭제 가능
- **답글 시스템**: 댓글에 대한 답글 작성
- **댓글 상호작용**: 좋아요, 신고
- **작성자 표시**: 게시물 작성자 댓글에 "작성자" 배지
- **UI 개선**: 사용자 아바타, 닉네임, 드롭다운 메뉴

#### **팔로우 시스템**

- **팔로우/언팔로우**: 사용자 간 팔로우 관계
- **팔로워/팔로잉 목록**: 모달로 팔로워/팔로잉 사용자 표시
- **팔로우 카운트**: 실시간 팔로워/팔로잉 수 표시
- **프로필 연동**: 팔로우 버튼으로 프로필 이동

#### **쪽지 시스템**

- **쪽지 작성**: 받는 사람 선택, 제목, 내용
- **쪽지 목록**: 받은 쪽지/보낸 쪽지 탭
- **쪽지 상세**: 개별 쪽지 조회, 읽음 표시
- **답장 기능**: 받은 쪽지에 답장 (자동 "Re:" 제목)
- **쪽지 삭제**: 소프트 삭제 (보낸 사람/받는 사람별)
- **사용자 검색**: 쪽지 작성 시 사용자 검색
- **알림 연동**: 읽지 않은 쪽지 수 표시

#### **프로필 시스템**

- **공개 프로필**: 다른 사용자 프로필 조회
- **개인 프로필**: 본인 프로필 (설정, 저장된 게시물, 댓글)
- **프로필 보안**: 공개/비공개 데이터 분리
- **프로필 상호작용**: 아바타/닉네임 클릭으로 프로필 이동, 쪽지 보내기
- **활동 탭**: 게시물, 댓글, 저장된 게시물

#### **UI/UX 개선**

- **반응형 디자인**: 모바일 친화적 레이아웃
- **다크모드**: 전체 다이어 앱 다크모드 지원
- **로딩 상태**: 스켈레톤, 스피너 등 로딩 UI
- **에러 처리**: 사용자 친화적 에러 메시지
- **날짜 포맷**: 한국어 로케일 기반 일관된 날짜 표시
- **네비게이션**: Next.js App Router 기반 SPA 경험

#### **보안 및 데이터 관리**

- **Row Level Security (RLS)**: Supabase RLS 정책 적용
- **인증 보호**: 인증 필요한 기능 보호
- **데이터 검증**: 클라이언트/서버 양쪽 데이터 검증
- **파일 업로드**: 안전한 이미지 업로드 및 압축
- **권한 관리**: 역할 기반 접근 제어

### 🔄 진행 중인 기능

#### **알림 시스템**

- 기본 구조 구현됨
- 실시간 알림 연동 필요

#### **검색 시스템**

- 기본 검색 구현됨
- 고급 필터링 및 정렬 개선 필요

#### **태그/주제 시스템**

- 데이터베이스 스키마 준비됨
- UI 구현 필요

### 📋 예정된 기능

#### **콜렉션 시스템**

- 게시물 저장 및 모음 기능
- 공개/비공개 콜렉션

#### **이벤트/스페이스**

- 실시간 이벤트 및 스페이스 기능

#### **고급 검색**

- 벡터 검색, 태그 기반 필터링

#### **성능 최적화**

- 이미지 최적화, 캐싱 전략
- SEO 최적화

### 🛠 기술적 구현 세부사항

#### **데이터베이스 스키마**

```sql
-- 주요 테이블 구조
profiles: id, username, bio, avatar_url, role, created_at
posts: id, title, content, author_id, created_at
comments: id, body, author_id, post_id, parent_id, created_at
messages: id, from_user_id, to_user_id, subject, content, read, deleted_by_sender, deleted_by_receiver, created_at
follows: id, follower_id, following_id, created_at
reactions: id, target_type, target_id, user_id, type, created_at
reports: id, target_type, target_id, reporter_id, reason, created_at
```

#### **API 엔드포인트**

- `/api/posts` - 게시물 CRUD
- `/api/comments` - 댓글 CRUD
- `/api/messages` - 쪽지 CRUD
- `/api/follows` - 팔로우/언팔로우
- `/api/reactions` - 좋아요 등 반응
- `/api/admin/*` - 관리자 기능

#### **주요 컴포넌트**

- `UserAvatar` - 사용자 아바타 및 상호작용
- `CommentSection` - 댓글 시스템
- `ProfileMeta` - 프로필 메타 정보
- `FollowButton` - 팔로우 버튼
- `MessageSystem` - 쪽지 시스템

### 📊 성능 지표

- **페이지 로드 시간**: 평균 1.5초 이하
- **이미지 압축**: 5MB → 512KB 이하
- **데이터베이스 쿼리**: 최적화된 조인 및 인덱스
- **사용자 경험**: 직관적인 UI/UX, 모바일 최적화

## 23) 부록: 용어

- **주제(Topic)**: 상위 분류(예: LLM, 멀티모달, 에이전트)
- **태그(Tag)**: 세부 키워드(예: RAG, 툴 사용, 벤치마크)
- **콜렉션(Collection)**: 사용자가 저장물을 묶어 공유 가능한 모음
