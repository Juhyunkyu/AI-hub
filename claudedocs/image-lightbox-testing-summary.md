# 이미지 라이트박스 Share/Delete 기능 테스트 요약

**작성일**: 2025-10-16
**상태**: 일부 완료, 추가 작업 필요

## 사용자 요구사항

사용자가 보고한 문제점:
1. **삭제 버튼**: "메시지 정보가 없습니다" 오류 발생
2. **친구 목록 UI**:
   - 소개글(bio)이 길면 잘림
   - 친구가 많아지면(100명+) 찾기 어려움
   - **요청**: 아바타 + 닉네임만 표시, 검색 기능 추가
3. **공유 기능**: 이전 세션에서 수정했으나 재테스트 필요

## 완료된 작업

### 1. Share 기능 수정
**파일**: `src/components/shared/image-lightbox.tsx`

**문제 1 - 400 Bad Request (Zod 검증 실패)**
- **위치**: Lines 252-260
- **원인**: CreateChatRoomSchema가 모든 필드 요구 (name, description, avatar_url, is_private, max_participants)
- **해결**:
```typescript
body: JSON.stringify({
  type: 'direct',
  participant_ids: [friendId],
  name: null,
  description: null,
  avatar_url: null,
  is_private: false,
  max_participants: null,
}),
```

**문제 2 - 403 Forbidden (잘못된 room ID 추출)**
- **위치**: Line 269
- **원인**: API가 `{ room: { id: ... } }` 구조로 응답하는데 `roomData.room_id` 사용
- **해결**:
```typescript
const roomId = roomData.room?.id || roomData.room_id || roomData.id;
```

**테스트 결과**:
- ✅ POST /api/chat/rooms 200
- ✅ POST /api/chat/messages 200
- ✅ "1명에게 이미지를 공유했습니다" 알림 표시
- ✅ 실시간 메시지 전송 성공

### 2. 친구 선택 UI 개선
**파일**: `src/components/shared/friend-selection-dialog.tsx`

**변경사항**:
- Line 5: Search 아이콘 import 추가
- Line 39: `searchQuery` state 추가
- Lines 54-61: `filteredFriends` 필터링 로직 구현
- Lines 110-120: 검색 입력 UI 추가
- Lines 135-138: 검색 결과 없음 상태 추가
- Lines 174-176: Bio 표시 제거 (username만 표시)

**테스트 결과**:
- ✅ Bio 제거됨 (아바타 + 닉네임만)
- ✅ 검색 입력창 정상 작동
- ✅ 실시간 필터링 작동

### 3. Delete 기능 Props 수정
**파일 1**: `src/components/shared/image-lightbox.tsx`
- Lines 624-645: ClickableImageProps 인터페이스에 delete 관련 props 추가
  - messageId, senderId, currentUserId, roomId
  - senderName, senderAvatar, sentAt
- Lines 647-666: ClickableImage 함수 signature 업데이트
- Lines 703-717: ImageLightbox에 props 전달

**파일 2**: `src/components/chat/virtualized/MessageRenderer.tsx`
- Lines 92-104: MessageContent에 currentUserId prop 추가
- Lines 141-149: ClickableImage에 delete props 전달
- Lines 577-583: MessageContent 호출 시 currentUserId 전달

**테스트 결과**:
- ✅ 삭제 확인 다이얼로그 표시
- ✅ DELETE /api/chat/messages/[id] 200 응답
- ✅ 라이트박스 자동 닫힘

## ⚠️ 사용자 피드백: "의도한대로 되지 않음"

사용자가 기대한 동작과 실제 동작이 다를 수 있습니다. 다음 사항을 확인 필요:

### 확인 필요 사항

1. **삭제 후 메시지 사라짐 확인**
   - 현재: DELETE API는 200 응답
   - 확인 필요: 채팅 목록에서 실제로 메시지가 사라졌는지?
   - 가능한 문제:
     - Realtime 업데이트 누락?
     - 캐시 무효화 안 됨?
     - Soft delete vs Hard delete 로직?

2. **친구 검색 기능**
   - 현재: 검색 입력창 추가됨
   - 확인 필요: 실제로 검색이 잘 되는지? (한글 입력 테스트)

3. **공유 후 메시지 확인**
   - 현재: POST 요청 성공
   - 확인 필요:
     - 상대방 채팅방에 이미지가 제대로 전송되었는지?
     - 이미지 미리보기가 정상인지?

## 다음 세션 작업 계획

### 1단계: 현재 문제 확인
```bash
# 서버 실행
npm run dev

# 브라우저에서 수동 테스트
# 1. 채팅방 접속
# 2. 이미지 업로드
# 3. Share 버튼 → 친구 선택 → 공유 실행
#    - 상대방 채팅방에 이미지 전송 확인
# 4. Delete 버튼 → 확인
#    - 메시지 목록에서 사라지는지 확인
# 5. 친구 검색 기능 테스트
```

### 2단계: 추가 수정 가능성

#### A. 삭제 후 UI 업데이트 문제
**가능한 원인**:
- TanStack Query 캐시 무효화 누락
- Realtime 구독에서 DELETE 이벤트 처리 누락

**확인 위치**:
- `src/components/shared/image-lightbox.tsx`: handleDelete 함수
- `src/hooks/use-chat-hook.ts`: Realtime 구독 로직

**수정 방향**:
```typescript
// handleDelete 성공 후
queryClient.invalidateQueries(['chat-messages', roomId]);
// 또는 optimistic update로 메시지 즉시 제거
```

#### B. 공유 후 이미지 표시 문제
**확인 위치**:
- `/api/chat/messages` 라우트: 이미지 메타데이터 저장
- MessageRenderer: 이미지 렌더링 로직

#### C. 친구 검색 성능 문제
**현재 구현**: 클라이언트 사이드 필터링
**개선 방향**: 친구가 많을 경우 서버 사이드 검색

### 3단계: 테스트 시나리오

**시나리오 1: 삭제 테스트**
```
1. 채팅방에 이미지 업로드
2. 이미지 클릭 → 라이트박스 열기
3. 삭제 버튼 클릭 → 확인
4. 기대 결과:
   - 라이트박스 닫힘 ✅
   - 채팅 목록에서 메시지 즉시 사라짐 ❓
   - 새로고침 후에도 메시지 없음 ❓
```

**시나리오 2: 공유 테스트**
```
1. 채팅방에 이미지 업로드
2. 이미지 클릭 → 라이트박스 열기
3. 공유 버튼 클릭 → 친구 선택 다이얼로그
4. 친구 검색 (예: "박" 입력)
5. 친구 선택 → 공유 버튼 클릭
6. 기대 결과:
   - "1명에게 이미지를 공유했습니다" 알림 ✅
   - 상대방 채팅방에 이미지 메시지 전송됨 ❓
   - 이미지가 정상적으로 표시됨 ❓
```

## 관련 파일 위치

### 핵심 파일
- `src/components/shared/image-lightbox.tsx` - 라이트박스 메인 컴포넌트
- `src/components/shared/friend-selection-dialog.tsx` - 친구 선택 다이얼로그
- `src/components/chat/virtualized/MessageRenderer.tsx` - 메시지 렌더링
- `src/app/api/chat/messages/[messageId]/route.ts` - 삭제 API
- `src/app/api/chat/messages/route.ts` - 메시지 생성 API
- `src/app/api/chat/rooms/route.ts` - 채팅방 생성 API

### 관련 문서
- `docs/CHAT_SYSTEM.md` - 채팅 시스템 전체 문서
- `supabase/migrations/20251016010000_add_soft_delete_to_chat_messages.sql` - Soft delete 마이그레이션

## 디버깅 팁

### 1. 서버 로그 확인
```bash
# DELETE 요청 확인
grep "DELETE /api/chat/messages"

# 응답 상태 확인 (200 = 성공)
# soft delete vs hard delete 메시지 확인
```

### 2. 브라우저 콘솔 확인
```javascript
// Realtime 이벤트 확인
// "📨 New realtime message received" 로그

// TanStack Query devtools에서 캐시 상태 확인
```

### 3. Supabase 확인
```sql
-- 메시지 실제 삭제 여부 확인
SELECT * FROM chat_messages WHERE id = 'message_id';

-- Soft delete 확인
SELECT deleted_for FROM chat_messages WHERE id = 'message_id';
```

## 예상되는 추가 작업

1. **handleDelete 함수 개선** (image-lightbox.tsx)
   - 성공 시 캐시 무효화 또는 optimistic update
   - 에러 처리 개선

2. **Realtime 구독 로직** (use-chat-hook.ts)
   - DELETE 이벤트 처리 추가
   - 메시지 목록에서 즉시 제거

3. **친구 검색 최적화**
   - 디바운싱 추가
   - 대소문자 구분 없음 검증

## 참고 사항

- **개발 서버**: `npm run dev` (포트 3000)
- **테스트 계정**: 주현규 (이미 로그인됨)
- **테스트 채팅방**: 박할매 (room_id: a009a352-0548-49af-a223-acfd497965d6)
- **Git 상태**:
  - Modified: docs/FEATURES.md
  - Branch: master
