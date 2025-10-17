# 채팅 시스템 상세

**문서 업데이트**: 2025-10-04

---

## 채팅 아키텍처

### 컴포넌트 계층 구조

```typescript
ChatLayout (메인 컨테이너)
├── useChatHook                    // 데이터 및 실시간 관리
├── useNotifications               // 알림 시스템
├── useChatUIState                 // UI 상태 관리
├── useChatMessageHandler          // 메시지 입력/전송
├── useResponsive                  // 반응형 감지
│
├── 채팅방 리스트
│   ├── ChatRoomAvatar
│   ├── 읽지 않은 메시지 배지
│   └── 마지막 메시지 미리보기
│
├── 메시지 영역
│   ├── VirtualizedMessageList     // @tanstack/react-virtual
│   │   └── MessageRenderer
│   │       ├── text
│   │       ├── image (라이트박스)
│   │       ├── file (다운로드)
│   │       └── location (카카오맵)
│   └── TypingIndicator
│
└── 입력 영역
    ├── ChatAttachmentMenu
    │   ├── GalleryOption
    │   ├── CameraOption
    │   ├── FileOption
    │   └── LocationOption
    ├── EmojiPicker
    └── Textarea
```

---

## 실시간 메시지 플로우

### 1. 메시지 전송 (Optimistic Update)

```typescript
sendMessage(content, roomId, file?)
  ↓
1) 즉시 UI에 임시 메시지 표시 (temp-${timestamp})
  ↓
2) API 호출: POST /api/chat/messages
  ↓
3) 성공 시: 임시 → 실제 메시지 교체
  ↓
4) 실패 시: 임시 메시지 제거
```

### 2. 실시간 수신 (Supabase Realtime)

```typescript
Realtime Channel Subscription
  ↓
새 메시지 이벤트 수신
  ↓
handleNewRealtimeMessage(message)
  ↓
1) 임시 메시지 확인 → 교체
2) sender 정보 보강
3) UI 자동 업데이트
```

---

## 파일 업로드 시스템

### 업로드 플로우

```typescript
1. ChatAttachmentMenu (+ 버튼)
   ├─ GalleryOption (이미지)
   ├─ CameraOption (사진 촬영)
   ├─ FileOption (파일)
   └─ LocationOption (위치)
   ↓
2. handleFileSelect([file])
   ├─ selectedFile 상태 업데이트
   └─ FilePreview 표시
   ↓
3. API: POST /api/chat/messages
   ├─ FormData 전송
   ├─ Supabase Storage 업로드
   └─ DB 저장 (file_url)
   ↓
4. 실시간 렌더링
   ├─ "image" → ClickableImage
   ├─ "file" → 다운로드 버튼
   └─ "location" → LocationMessage
```

### 메시지 타입 자동 판단

```typescript
function getMessageType(file?: File, fileName?: string) {
  // location-*.json → "location"
  // image/* → "image"
  // 기타 → "file"
}
```

---

## 이미지 편집 시스템

### 3단계 툴바 시스템

```typescript
Step 1 (기본): [저장][공유][삭제][편집]
  ↓ [편집] 클릭
Step 2 (편집 선택): [필터][자르기][텍스트][이모지][펜]
  ↓ [펜] 클릭
Step 3 (펜 모드): [펜][지우개][색상 6가지][전체삭제]
```

### 펜 그리기 기능

- **라이브러리**: react-konva 19.0.10
- **색상**: 6가지 (빨강, 파랑, 초록, 노랑, 검정, 흰색)
- **굵기**: 4단계
- **기능**: 펜, 지우개, 전체 지우기, 회전, 줌

### 캔버스 크기 자동 조정

```typescript
// 실제 렌더링된 이미지 크기 측정
const handleImageLoad = () => {
  const width = imageRef.current.offsetWidth;
  const height = imageRef.current.offsetHeight;
  setCanvasSize({ width, height });
};

// 이미지 합성 시 스케일 비율 적용
const scaleX = img.width / canvasSize.width;
const scaleY = img.height / canvasSize.height;
ctx.scale(scaleX, scaleY);
```

---

## 위치 공유 시스템

### 카카오맵 통합

```typescript
// LocationMessage 컴포넌트
useEffect(() => {
  const kakaoAPI = await loadKakaoMaps();

  const map = new kakaoAPI.maps.Map(container, {
    center: new kakaoAPI.maps.LatLng(lat, lng),
    level: 3,
    draggable: false
  });

  const marker = new kakaoAPI.maps.Marker({
    position: options.center,
    map: map
  });
}, [message.id]);
```

### 위치 데이터 구조

```typescript
{
  type: 'location',
  name: '장소명',
  address: '주소',
  coordinates: { x: longitude, y: latitude },
  phone: '전화번호',
  url: '카카오맵 URL'
}
```

---

## 성능 최적화

### 1. 메시지 가상화

```typescript
// @tanstack/react-virtual
- 대량 메시지 처리 시 메모리 효율
- 보이는 영역만 렌더링
- 동적 높이 측정
```

### 2. React 최적화

```typescript
// React.memo + 비교 함수
const MessageRenderer = memo(MessageRendererBase, (prev, next) => {
  return (
    prev.index === next.index &&
    prev.style.height === next.style.height &&
    prev.data.messages === next.data.messages
  );
});
```

### 3. 타이핑 Debounce

```typescript
const debouncedUpdateTyping = debounce(updateTyping, 500);
// 85% API 호출 감소
```

---

## UX 패턴

### 메시지 그룹핑 (카카오톡 스타일)

- 같은 사용자의 연속 메시지
- 5분 이내: 아바타/이름 숨김
- 같은 분 내: 시간 표시 마지막만

### 모바일 최적화

- Sheet (모바일) vs Popover (데스크톱)
- 터치 제스처 지원
- 키보드 자동 숨김

---

## 읽지 않은 메시지 카운트 시스템

### 아키텍처

```typescript
// 읽음 처리 플로우
채팅방 진입/메시지 수신
  ↓
markAsRead() 호출
  ↓
POST /api/chat/read
  ↓
message_reads 테이블 UPSERT
  ↓
unread_message_counts 뷰 자동 갱신
  ↓
TanStack Query 무효화 (invalidateQueries)
  ↓
UI 자동 업데이트
```

### 데이터베이스 구조

#### message_reads 테이블
```sql
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  room_id UUID NOT NULL REFERENCES chat_rooms(id),
  last_read_message_id UUID REFERENCES chat_messages(id),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);
```

**역할**: 각 사용자의 채팅방별 마지막 읽은 시점 추적

#### unread_message_counts 뷰
```sql
CREATE VIEW unread_message_counts AS
SELECT
  crp.room_id,
  crp.user_id,
  cr.name AS room_name,
  cr.updated_at AS latest_message_time,
  COUNT(cm.id) AS unread_count
FROM chat_room_participants crp
JOIN chat_rooms cr ON cr.id = crp.room_id
-- ✅ message_reads 테이블 기반 (2025-10-16 수정)
LEFT JOIN message_reads mr
  ON mr.room_id = crp.room_id
  AND mr.user_id = crp.user_id
-- ✅ mr.last_read_at 이후 메시지만 카운트
LEFT JOIN chat_messages cm
  ON cm.room_id = crp.room_id
  AND cm.created_at > COALESCE(mr.last_read_at, '1970-01-01'::timestamptz)
  AND cm.sender_id != crp.user_id
GROUP BY crp.room_id, crp.user_id, cr.name, cr.updated_at;
```

**역할**: 읽지 않은 메시지 수를 실시간으로 계산

### 2025-10-16 버그 수정

#### 문제 상황
- **증상**: 같은 채팅방 안에 있어도 메시지 수신 시 읽지 않은 카운트 증가
- **예시**: 주현규와 박할매가 같은 채팅방에서 대화 중 → 채팅방 리스트에 빨간 배지(1) 표시

#### 근본 원인
```typescript
// ❌ 기존 코드 (버그)
// unread_message_counts 뷰가 chat_room_participants.last_read_at 사용
LEFT JOIN chat_messages cm
  ON cm.created_at > COALESCE(crp.last_read_at, '1970-01-01')

// ✅ /api/chat/read는 message_reads 테이블에 저장
await supabase.from('message_reads').upsert({
  user_id, room_id, last_read_at: NOW()
});

// → 데이터 소스 불일치로 읽음 처리가 반영되지 않음
```

#### 해결 방법
1. **마이그레이션 생성**
   - 파일: `supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql`
   - 뷰를 `message_reads` 테이블 기반으로 재작성
   - 성능 최적화 인덱스 추가

2. **적용 방법**
   ```bash
   # Supabase Dashboard SQL Editor에서 직접 실행
   # 또는
   npx supabase db push
   ```

3. **검증**
   - Manual Test: `tests/manual/test-chat-unread.md`
   - E2E Test: `tests/e2e/chat-unread-count.spec.ts`
   - Migration Guide: `MIGRATION_GUIDE.md`

#### 결과
- ✅ 채팅방 안: 메시지 수신 시 카운트 증가 안 함
- ✅ 채팅방 밖: 정확히 카운트 증가
- ✅ 읽음 처리 실시간 반영
- ✅ 성능 최적화 (인덱스 추가)

---

[← 아키텍처](ARCHITECTURE.md) | [기능 상세 →](FEATURES.md)
