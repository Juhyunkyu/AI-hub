# Hard Delete 실시간 삭제 수정 완료

**작성일**: 2025-10-17
**버전**: Final
**상태**: ✅ 완전 해결

---

## 📋 문제 정의

### 발견된 문제
이전에 Soft Delete는 커스텀 이벤트로 해결했지만, Hard Delete는 여전히 Realtime DELETE 이벤트에 의존하고 있었습니다.

**테스트 결과**:
- Hard Delete API 호출 성공 (200 OK)
- 메시지가 DB에서 정상 삭제됨
- **그러나 UI에서 메시지가 사라지지 않음** (페이지 새로고침 필요)
- Realtime DELETE 이벤트가 수신되지 않음

### 근본 원인 분석

**핵심 발견**: Admin Client (Service Role)로 수행한 **DELETE 작업도 UPDATE와 마찬가지로 Realtime 이벤트를 트리거하지 않습니다.**

#### 왜 이런 일이 발생하는가?

1. **Service Role 권한**: Admin Client는 Service Role 키를 사용하여 RLS를 우회
2. **Realtime 구독 범위**: 클라이언트의 Realtime 구독은 해당 사용자의 권한 범위 내에서만 이벤트 수신
3. **권한 불일치**: Admin Client의 DELETE는 시스템 레벨에서 실행되므로, 일반 사용자 권한으로 구독 중인 클라이언트는 이벤트를 받을 수 없음

---

## ✅ 해결 방법

### 1. 서버 측 수정 (`route.ts`)

Hard Delete 응답에 `deleted_message_id` 추가:

```typescript
// Line 281-286
console.log("✅ Message deleted from DB successfully");

// ✅ Hard Delete도 messageId 반환 (Realtime 이벤트 대체)
return NextResponse.json({
  success: true,
  delete_type: "hard",
  message: "Message deleted for everyone",
  deleted_message_id: messageId, // 클라이언트가 직접 삭제 처리
});
```

### 2. 클라이언트 측 수정 (`image-lightbox.tsx`)

Hard Delete 시 커스텀 이벤트 발생:

```typescript
// Line 369-378
} else if (result.delete_type === 'hard') {
  toast.success('메시지가 삭제되었습니다');

  // ✅ Hard Delete도 Admin Client 사용으로 Realtime 이벤트가 트리거되지 않으므로
  // API 응답의 deleted_message_id로 직접 삭제 처리
  if (result.deleted_message_id) {
    window.dispatchEvent(new CustomEvent('chat-message-deleted', {
      detail: { messageId: result.deleted_message_id }
    }));
  }
}
```

### 3. 상태 관리 수정 (`use-chat.ts`)

Hard Delete 커스텀 이벤트 리스너 추가:

```typescript
// Line 477-496
// ✅ Admin Client DELETE 이벤트 수신 (커스텀 이벤트 - Hard Delete)
useEffect(() => {
  const handleCustomDelete = (event: Event) => {
    const customEvent = event as CustomEvent<{ messageId: string }>;
    const { messageId } = customEvent.detail;

    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Custom message delete event received:', messageId);
    }

    // handleMessageDelete를 통해 처리
    handleMessageDelete(messageId);
  };

  window.addEventListener('chat-message-deleted', handleCustomDelete);

  return () => {
    window.removeEventListener('chat-message-deleted', handleCustomDelete);
  };
}, [handleMessageDelete]);
```

---

## 🧪 테스트 결과

### Playwright MCP 테스트 (주현규 계정)

**시나리오**: 본인이 보낸 이미지 삭제 (상대방이 읽지 않음)

**콘솔 로그**:
```
🔍 DELETE API URL: /api/chat/messages/6c318035-4c50-4e37-a8a2-40910701dc22
🔍 DELETE API response: {success: true, delete_type: "hard", message: "Message deleted for everyone", deleted_message_id: "6c318035-4c50-4e37-a8a2-40910701dc22"}
🗑️ Custom message delete event received: 6c318035-4c50-4e37-a8a2-40910701dc22
```

**결과**: ✅ 이미지가 즉시 UI에서 제거됨 (페이지 새로고침 불필요)

---

## 🔄 완전한 동작 흐름

### Soft Delete (상대방 메시지 또는 읽은 본인 메시지)

```
1. 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. Admin Client로 deleted_for 배열에 사용자 ID 추가 (UPDATE)
   ↓
4. API 응답에 updated_message 포함
   ↓
5. 클라이언트가 'chat-message-updated' 커스텀 이벤트 발생
   ↓
6. use-chat.ts에서 이벤트 수신
   ↓
7. handleMessageUpdate 호출
   ↓
8. deleted_for 체크 → 메시지 필터링
   ↓
9. UI에서 즉시 제거 ✅
```

### Hard Delete (읽지 않은 본인 메시지)

```
1. 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. Admin Client로 DB에서 메시지 DELETE
   ↓
4. API 응답에 deleted_message_id 포함
   ↓
5. 클라이언트가 'chat-message-deleted' 커스텀 이벤트 발생
   ↓
6. use-chat.ts에서 이벤트 수신
   ↓
7. handleMessageDelete 호출
   ↓
8. UI에서 즉시 제거 ✅
```

---

## 📊 수정된 파일

1. **`src/app/api/chat/messages/[messageId]/route.ts`**
   - Line 281-286: Hard Delete 후 deleted_message_id 반환

2. **`src/components/shared/image-lightbox.tsx`**
   - Line 369-378: Hard Delete 시 커스텀 이벤트 발생

3. **`src/hooks/use-chat.ts`**
   - Line 477-496: Hard Delete 커스텀 이벤트 수신 및 처리

---

## 🎯 결론

### 최종 해결책

**문제**: Admin Client의 UPDATE와 DELETE 모두 Realtime 이벤트를 트리거하지 않음

**해결**:
- Soft Delete: API 응답에 `updated_message` 포함 → `chat-message-updated` 커스텀 이벤트
- Hard Delete: API 응답에 `deleted_message_id` 포함 → `chat-message-deleted` 커스텀 이벤트

**결과**: 페이지 새로고침 없이 실시간으로 이미지 삭제 완전 구현 ✅

### 핵심 교훈

1. **Admin Client의 제약**: Service Role로 수행한 모든 데이터베이스 작업(UPDATE, DELETE)은 일반 클라이언트가 구독한 Realtime 이벤트를 트리거하지 않음

2. **통일된 해결 패턴**: Soft Delete와 Hard Delete 모두 커스텀 이벤트를 사용하여 일관성 있게 해결

3. **API 응답 활용**: Realtime에 의존하지 않고 API 응답에 필요한 데이터를 포함하여 클라이언트가 직접 상태 업데이트

---

## 📸 스크린샷

테스트 성공 스크린샷: `.playwright-mcp/hard-delete-success.png`

- 이미지 삭제 전/후 비교
- 페이지 새로고침 없이 즉시 UI 업데이트 확인
