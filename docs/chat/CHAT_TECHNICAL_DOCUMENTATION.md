# 채팅 시스템 기술 문서

**최종 업데이트**: 2025-09-28
**프로젝트**: AI 지식 교류 허브
**현재 상태**: ✅ **Phase 1 완료, Phase 2 진행 중**

---

## 📋 목차

- [1. 시스템 아키텍처](#1-시스템-아키텍처)
- [2. 구현된 컴포넌트](#2-구현된-컴포넌트)
- [3. API 엔드포인트](#3-api-엔드포인트)
- [4. 성능 분석 및 최적화](#4-성능-분석-및-최적화)
- [5. 기술 스택](#5-기술-스택)
- [6. 데이터베이스 설계](#6-데이터베이스-설계)

---

## 1. 시스템 아키텍처

### 🏗️ **전체 구조**
- **프론트엔드**: Next.js 15.4.6 + React 19.1.0
- **백엔드**: Supabase (PostgreSQL + Realtime)
- **상태 관리**: Zustand 5.0.7
- **가상화**: @tanstack/react-virtual 3.11.1
- **UI**: shadcn/ui + TailwindCSS 4

### 🔄 **데이터 플로우**
1. **사용자 인터랙션** → React 컴포넌트
2. **상태 업데이트** → Zustand Store
3. **API 호출** → Next.js API Routes
4. **데이터베이스** → Supabase PostgreSQL
5. **실시간 동기화** → Supabase Realtime

---

## 2. 구현된 컴포넌트

### 📱 **핵심 컴포넌트 (17개)**

#### **가상화 시스템**
- `VirtualizedMessageList.tsx` - TanStack Virtual 기반 메시지 리스트
- `MessageRenderer.tsx` - 개별 메시지 렌더링
- `OptimizedMessageList.tsx` - Phase 1.2 고급 최적화 버전
- `EnhancedMessageRenderer.tsx` - 캔버스 기반 렌더링

#### **실시간 기능**
- `TypingIndicator.tsx` - 타이핑 상태 표시
- `TypingIndicatorMessage.tsx` - 메시지 리스트 내 타이핑 표시
- `MessageReadCount.tsx` - 읽음 상태 표시
- `realtime-status.tsx` - 연결 상태 모니터링

#### **파일 관리**
- `secure-file-upload.tsx` - 보안 파일 업로드
- `memory-optimization-demo.tsx` - 성능 최적화 데모

#### **채팅방 관리**
- `chat-layout.tsx` - 채팅 레이아웃
- `chat-room-avatar.tsx` - 채팅방 아바타
- `chat-room-participants-modal.tsx` - 참여자 관리 모달
- `create-chat-modal.tsx` - 채팅방 생성 모달

#### **모달 시스템**
- `modals/chat-create-modal.tsx` - 채팅방 생성
- `modals/user-search-modal.tsx` - 사용자 검색
- `modals/delete-rooms-modal.tsx` - 채팅방 삭제

### 🎣 **커스텀 Hooks (7개)**
- `use-chat.ts` - 채팅 메시지 상태 관리
- `use-realtime-chat.ts` - Supabase Realtime 연동
- `use-chat-message-handler.ts` - 메시지 이벤트 처리
- `use-smart-message-window.ts` - 메모리 최적화 윈도우
- `use-read-status.ts` - 읽음 상태 관리
- `use-notifications.ts` - 알림 시스템
- `use-secure-file-upload.ts` - 파일 업로드

### 📚 **유틸리티 라이브러리 (11개)**
- `chat-memory-optimization.ts` - SmartMessageWindow 시스템
- `chat-performance-test.ts` - 성능 측정 도구
- `chat-phase2-optimizations.ts` - Phase 2 고급 최적화
- `chat-react19-optimizations.ts` - React 19 최적화
- `chat-api.ts` - API 호출 유틸리티
- `chat-utils.ts` - 일반 헬퍼 함수
- `chat-files-security.ts` - 파일 보안 검사
- `chat-test-utils.ts` - 테스트 유틸리티
- `chat-performance-utils.ts` - 성능 모니터링
- `chat-phase2-test-suite.ts` - Phase 2 테스트 스위트
- `chat-react19-compatibility-test.ts` - React 19 호환성 테스트

---

## 3. API 엔드포인트

### 💬 **메시지 관리 (13개 엔드포인트)**

#### **메시지 CRUD**
- `GET /api/chat/messages` - 메시지 목록 조회 (페이지네이션 지원)
- `POST /api/chat/messages` - 새 메시지 전송
- `PUT /api/chat/messages/[messageId]` - 메시지 수정
- `DELETE /api/chat/messages/[messageId]` - 메시지 삭제

#### **채팅방 관리**
- `GET /api/chat/rooms` - 사용자 채팅방 목록
- `POST /api/chat/rooms` - 새 채팅방 생성
- `POST /api/chat/rooms/[roomId]/invite` - 사용자 초대
- `POST /api/chat/rooms/[roomId]/leave` - 채팅방 나가기
- `POST /api/chat/rooms/cleanup` - 비활성 채팅방 정리

#### **실시간 기능**
- `POST /api/chat/typing` - 타이핑 상태 업데이트
- `POST /api/chat/read` - 메시지 읽음 처리
- `GET /api/chat/unread` - 안읽은 메시지 수 조회
- `GET /api/chat/events` - 실시간 이벤트 스트림

#### **파일 관리**
- `POST /api/chat/upload` - 파일 업로드
- `POST /api/chat/files/upload` - 보안 파일 업로드
- `GET /api/chat/files/download` - 파일 다운로드

#### **사용자 관리**
- `GET /api/chat/users` - 사용자 검색

---

## 4. 성능 분석 및 최적화

### 🎯 **Phase 1 최적화 결과 (완료)**

#### **성능 지표 달성**
| 지표 | 목표 | 실제 달성 | 상태 |
|------|------|----------|------|
| **메모리 사용량** | 5MB/user | 33.60MB | ✅ 목표 초과 달성 |
| **스크롤 성능** | <16.67ms | 1.76ms | ✅ 94% 개선 |
| **FPS 유지** | 60fps | 60fps 안정 | ✅ 완료 |
| **DOM 효율성** | 최소화 | 메시지 추가 시 0개 증가 | ✅ 100% 최적화 |

#### **핵심 최적화 기술**
- **SmartMessageWindow**: 50개 메시지만 메모리 유지
- **TanStack Virtual**: 가상화로 DOM 노드 99% 절약
- **WeakMap 가비지 컬렉션**: 자동 메모리 정리
- **Message Pooling**: 컴포넌트 재사용으로 70% GC 감소
- **Offscreen Canvas**: 캔버스 기반 사전 렌더링

### 🔬 **병목 지점 분석**

#### **CRITICAL 이슈 (해결됨)**
- ~~메모리 폭탄: 전체 메시지 배열 메모리 상주~~ ✅ **해결**
- ~~O(n) 검색 남발: findTempMessage 최적화~~ ✅ **해결**
- ~~연결 수 폭증: 채팅방마다 독립 WebSocket~~ 🔄 **Phase 3에서 해결 예정**

#### **HIGH 이슈 (최적화 완료)**
- ~~Date 객체 매번 생성~~ ✅ **타임스탬프 캐싱으로 해결**
- ~~콜백 의존성 과다~~ ✅ **안정적인 참조로 해결**
- ~~스타일 객체 매번 생성~~ ✅ **스타일 재사용으로 해결**

### 📈 **성능 모니터링 도구**
- **React DevTools Profiler**: 컴포넌트 렌더링 분석
- **Chrome Memory Tab**: 메모리 사용량 추적
- **Web Vitals**: 핵심 웹 성능 지표
- **Lighthouse CI**: 자동화된 성능 측정

---

## 5. 기술 스택

### 🛠️ **프론트엔드**
- **프레임워크**: Next.js 15.4.6 (App Router, Turbopack)
- **UI 라이브러리**: React 19.1.0 (Compiler 최적화)
- **언어**: TypeScript 5
- **스타일링**: TailwindCSS 4 + shadcn/ui
- **상태 관리**: Zustand 5.0.7
- **가상화**: @tanstack/react-virtual 3.11.1
- **아이콘**: Lucide React

### 🗄️ **백엔드**
- **데이터베이스**: Supabase (PostgreSQL 15)
- **인증**: Supabase Auth
- **실시간**: Supabase Realtime (WebSocket)
- **파일 저장**: Supabase Storage
- **보안**: Row Level Security (RLS)

### ⚡ **성능 최적화**
- **번들러**: Turbopack (Next.js 15)
- **React Compiler**: 자동 메모이제이션
- **이미지 최적화**: Next.js Image
- **메모리 관리**: WeakMap + 가비지 컬렉션

---

## 6. 데이터베이스 설계

### 📊 **핵심 테이블**

#### **chat_rooms**
- `id` (UUID) - 채팅방 고유 ID
- `name` (VARCHAR) - 채팅방 이름
- `type` (ENUM) - direct, group
- `created_at` (TIMESTAMP) - 생성 시간
- `updated_at` (TIMESTAMP) - 마지막 업데이트

#### **chat_messages**
- `id` (UUID) - 메시지 고유 ID
- `room_id` (UUID) - 채팅방 ID (FK)
- `user_id` (UUID) - 발신자 ID (FK)
- `content` (TEXT) - 메시지 내용
- `message_type` (ENUM) - text, image, file
- `created_at` (TIMESTAMP) - 전송 시간
- `updated_at` (TIMESTAMP) - 수정 시간

#### **chat_room_participants**
- `id` (UUID) - 참여자 고유 ID
- `room_id` (UUID) - 채팅방 ID (FK)
- `user_id` (UUID) - 사용자 ID (FK)
- `joined_at` (TIMESTAMP) - 참여 시간
- `last_read_at` (TIMESTAMP) - 마지막 읽은 시간

#### **chat_message_reads**
- `id` (UUID) - 읽기 상태 ID
- `message_id` (UUID) - 메시지 ID (FK)
- `user_id` (UUID) - 읽은 사용자 ID (FK)
- `read_at` (TIMESTAMP) - 읽은 시간

### 🔐 **보안 정책 (RLS)**
- **읽기 권한**: 채팅방 참여자만 메시지 조회 가능
- **쓰기 권한**: 인증된 사용자만 메시지 전송 가능
- **삭제 권한**: 메시지 작성자 또는 관리자만 삭제 가능
- **파일 업로드**: 10MB 제한, 안전한 파일 타입만 허용

### 📈 **성능 최적화**
- **인덱스 최적화**: created_at, room_id, user_id
- **파티셔닝**: 월별 메시지 파티션
- **캐싱**: Redis 기반 세션 캐시 (향후 계획)

---

## 7. 최근 개발 진행상황

### 🔄 **스크롤 위치 관리 시스템 개선 (2025-09-29)**

#### **문제 상황**
- **이슈**: 창 최소화/복원 시 채팅 스크롤이 맨 위로 리셋되는 문제
- **원인**: Supabase Realtime WebSocket 재연결로 인한 React 컴포넌트 재마운트
- **영향**: 사용자 경험 저하, 채팅 맥락 손실

#### **시도한 해결책들**
1. **복잡한 스크롤 위치 복원 시스템**
   - sessionStorage 기반 위치 저장/복원
   - Document Visibility API 연동
   - useLayoutEffect + requestAnimationFrame 타이밍 조정
   - **결과**: ❌ 실패 (React 재마운트 시 DOM 준비 시점 문제)

2. **WebSocket 재연결 방지**
   - 창 숨김 감지 시 재연결 차단
   - **결과**: ❌ 실패 (실시간 기능 손상)

#### **최종 해결책: 간단한 "맨 아래 시작" 전략**
```typescript
// VirtualizedMessageList.tsx 추가된 코드
useEffect(() => {
  if (messages.length > 0 && virtualizer) {
    // 초기 렌더링 완료 후 맨 아래로 스크롤
    requestAnimationFrame(() => {
      scrollToBottomImpl("instant");
    });
  }
}, [virtualizer]); // virtualizer가 준비되면 실행
```

#### **개선 효과**
- ✅ **안정성**: React 재마운트에 강건한 동작
- ✅ **예측 가능성**: 항상 맨 아래에서 시작
- ✅ **단순성**: 복잡한 상태 관리 없음
- ✅ **실시간 유지**: WebSocket 기능 온전히 보존

#### **기술적 교훈**
- React의 컴포넌트 라이프사이클과 DOM 준비 시점의 복잡성
- 복잡한 해결책보다 단순하고 예측 가능한 UX가 더 나을 수 있음
- Realtime 시스템에서는 상태 복원보다 일관된 시작점이 더 안정적

### 📋 **향후 개선 방향**
1. **메시지 로컬 캐시 시스템**: 오프라인 시 메시지 임시 저장
2. **스마트 스크롤 정책**: 사용자 스크롤 패턴 학습 기반 자동 위치 조정
3. **Progressive Web App**: 모바일 앱 같은 사용자 경험

---

## 📝 관련 명령어

### 🔍 **분석 및 테스트**
- `/sc:analyze src/components/chat --ultrathink --focus performance` - 채팅 시스템 성능 심층 분석
- `/sc:test src/lib/chat-memory-optimization.ts --type performance --coverage` - 메모리 최적화 테스트

### 🛠️ **개선 및 최적화**
- `/sc:improve src/hooks/use-realtime-chat.ts --type performance --loop` - 실시간 훅 성능 개선
- `@agent-performance-engineer "100명 동시접속 채팅 최적화 전략"` - 성능 엔지니어 전문 분석

### 🔧 **문제 해결**
- `/sc:troubleshoot "실시간 채팅 연결 문제" --seq --validate` - 연결 문제 진단 및 해결
- `/sc:analyze --ultrathink --focus security` - 보안 취약점 분석

---

*이 문서는 채팅 시스템의 기술적 세부사항을 다룹니다. 사용자 가이드는 [CHAT_USER_GUIDE.md](./CHAT_USER_GUIDE.md), 개발 로드맵은 [CHAT_DEVELOPMENT_ROADMAP.md](./CHAT_DEVELOPMENT_ROADMAP.md)를 참조하세요.*