# 실시간 이미지 삭제 문제 해결 방안

**작성일**: 2025-10-17
**버전**: 3.0 - Hard Delete 완전 해결
**상태**: ✅ 완전 해결 (Soft Delete + Hard Delete)

---

## 📋 문제 요약

### 원래 문제
- 이미지를 삭제해도 실시간으로 UI에서 사라지지 않음
- 페이지를 새로고침해야만 삭제된 이미지가 사라짐
- Supabase Realtime 구독은 정상 작동 중

### 근본 원인

**Admin Client (Service Role)로 UPDATE를 수행하면 Realtime 이벤트가 클라이언트에 전달되지 않습니다.**

#### 왜 이런 일이 발생하나요?

1. **Service Role 권한**: Admin Client는 Service Role 키를 사용하여 RLS를 우회합니다.
2. **Realtime 구독 범위**: 클라이언트의 Realtime 구독은 해당 사용자의 권한 범위 내에서만 이벤트를 수신합니다.
3. **권한 불일치**: Admin Client의 UPDATE는 시스템 레벨에서 실행되므로, 일반 사용자 권한으로 구독 중인 클라이언트는 이벤트를 받을 수 없습니다.

#### 코드 증거

**AS-IS (문제 있는 코드)**:
```typescript
// Admin Client로 UPDATE → Realtime 이벤트 미발생
const { error } = await supabaseAdmin
  .from("chat_messages")
  .update({ deleted_for: updatedDeletedFor })
  .eq("id", messageId);

// 클라이언트는 이벤트를 받지 못함!
```

---

## ✅ 해결 방법

### 방법 1: API 응답에 업데이트된 메시지 포함 (채택)

Admin Client UPDATE 후 일반 클라이언트로 조회하여 응답에 포함시킵니다.

#### 서버 측 수정 (`route.ts`)

```typescript
// ✅ Soft Delete 후 업데이트된 메시지 반환
const { error: softDeleteError } = await supabaseAdmin
  .from("chat_messages")
  .update({ deleted_for: updatedDeletedFor })
  .eq("id", messageId);

if (softDeleteError) {
  return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
}

// 📌 일반 클라이언트로 조회하여 응답에 포함
const { data: updatedMessage } = await supabase
  .from("chat_messages")
  .select("*")
  .eq("id", messageId)
  .single();

return NextResponse.json({
  success: true,
  delete_type: "soft",
  message: "Message hidden for you",
  updated_message: updatedMessage, // ✅ 클라이언트가 직접 업데이트
});
```

#### 클라이언트 측 수정 (`image-lightbox.tsx`)

```typescript
const result = await response.json();

if (result.success) {
  if (result.delete_type === 'soft') {
    toast.success('메시지가 숨겨졌습니다');

    // ✅ Admin Client는 Realtime 이벤트를 트리거하지 않으므로
    // API 응답의 updated_message로 직접 업데이트
    if (result.updated_message) {
      window.dispatchEvent(new CustomEvent('chat-message-updated', {
        detail: result.updated_message
      }));
    }
  } else {
    toast.success('메시지가 삭제되었습니다');
    // Hard Delete는 Realtime DELETE 이벤트가 정상 작동
  }

  onClose();
}
```

#### 상태 관리 수정 (`use-chat.ts`)

```typescript
// ✅ Admin Client UPDATE 이벤트 수신 (커스텀 이벤트)
useEffect(() => {
  const handleCustomUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<ChatMessage>;
    const updatedMessage = customEvent.detail;

    if (process.env.NODE_ENV === 'development') {
      console.log('📨 Custom message update event received:', updatedMessage.id);
    }

    // handleMessageUpdate를 통해 처리
    handleMessageUpdate(updatedMessage);
  };

  window.addEventListener('chat-message-updated', handleCustomUpdate);

  return () => {
    window.removeEventListener('chat-message-updated', handleCustomUpdate);
  };
}, [handleMessageUpdate]);
```

---

## 🔄 동작 흐름

### Soft Delete (상대방 메시지 삭제)

```
1. 사용자가 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. Admin Client로 deleted_for 배열에 사용자 ID 추가 (UPDATE)
   ↓
4. 일반 Client로 업데이트된 메시지 조회
   ↓
5. API 응답에 updated_message 포함
   ↓
6. 클라이언트가 커스텀 이벤트 발생
   ↓
7. use-chat.ts에서 이벤트 수신
   ↓
8. handleMessageUpdate 호출
   ↓
9. deleted_for 배열에 현재 사용자 포함 → 메시지 필터링
   ↓
10. UI에서 즉시 제거 ✅
```

### Hard Delete (본인 메시지 삭제 - 읽지 않음)

```
1. 사용자가 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. 읽음 상태 확인 → 아무도 안 읽음
   ↓
4. Admin Client로 DB에서 메시지 DELETE
   ↓
5. Admin Client로 삭제된 메시지 ID를 응답에 포함
   ↓
6. 클라이언트가 커스텀 이벤트 발생 (chat-message-deleted)
   ↓
7. use-chat.ts에서 이벤트 수신
   ↓
8. handleMessageDelete 호출
   ↓
9. UI에서 즉시 제거 ✅
```

---

## 🧪 테스트 방법

### 1. Soft Delete 테스트

1. 박할매(상대방) 계정으로 이미지 전송
2. 주현규(본인) 계정으로 해당 이미지 삭제
3. 콘솔 로그 확인:
   ```
   🔍 DELETE request for messageId: xxx
   💡 Deleting other's message - Soft Delete
   ✅ Soft delete successful
   📨 Custom message update event received: xxx
   🗑️ Message xxx soft deleted for current user, removing from UI
   ```
4. 새로고침 없이 이미지가 즉시 사라지는지 확인 ✅

### 2. Hard Delete 테스트

1. 주현규(본인) 계정으로 이미지 전송
2. 상대방이 읽기 전에 삭제
3. 콘솔 로그 확인:
   ```
   🔍 DELETE request for messageId: xxx
   💡 No one read - Hard Delete path
   ✅ Message deleted from DB successfully
   🔍 DELETE API response: {success: true, delete_type: "hard", ...}
   🗑️ Custom message delete event received: xxx
   ```
4. 새로고침 없이 이미지가 즉시 사라지는지 확인 ✅

---

## 📊 구현 파일 목록

### 수정된 파일

1. **`src/app/api/chat/messages/[messageId]/route.ts`**
   - Line 83-94: Soft Delete 후 updated_message 반환
   - Line 155-166: 읽음 확인 실패 시 updated_message 반환
   - Line 199-210: 읽음 후 Soft Delete updated_message 반환
   - Line 281-286: Hard Delete 후 deleted_message_id 반환

2. **`src/components/shared/image-lightbox.tsx`**
   - Line 359-368: Soft Delete 시 커스텀 이벤트 발생 (chat-message-updated)
   - Line 369-378: Hard Delete 시 커스텀 이벤트 발생 (chat-message-deleted)

3. **`src/hooks/use-chat.ts`**
   - Line 456-475: Soft Delete 커스텀 이벤트 수신 및 처리
   - Line 477-496: Hard Delete 커스텀 이벤트 수신 및 처리

### 관련 파일 (변경 없음)

- `src/lib/supabase/server.ts`: Admin Client 구현
- `src/hooks/use-realtime-chat.ts`: Realtime 구독
- `use-chat.ts` handleMessageUpdate: Soft Delete 필터링 로직

---

## ⚠️ 주의사항

### 1. Admin Client 사용 시 Realtime 제한

**문제**: Service Role 키로 UPDATE/DELETE를 수행하면 일반 사용자는 Realtime 이벤트를 받지 못합니다.

**해결**:
- Soft Delete (UPDATE): API 응답에 updated_message 포함 + 커스텀 이벤트
- Hard Delete (DELETE): Realtime DELETE 이벤트 정상 작동

### 2. 커스텀 이벤트 사용 이유

**대안 1**: 일반 클라이언트로 UPDATE 수행
- ❌ 문제: RLS 정책이 상대방 메시지 수정을 막음

**대안 2**: RLS 정책 완화
- ❌ 문제: 보안 위험, 다른 필드 수정 가능

**채택한 방법**: Admin Client UPDATE + 커스텀 이벤트
- ✅ 장점: 보안 유지, Realtime 대체, 명확한 제어

### 3. Hard Delete vs Soft Delete

| 상황 | 동작 | 이벤트 방식 |
|------|------|------------|
| 본인 메시지 + 읽지 않음 | Hard Delete (DB 삭제) | 커스텀 이벤트 (chat-message-deleted) ✅ |
| 본인 메시지 + 읽음 | Soft Delete (deleted_for 추가) | 커스텀 이벤트 (chat-message-updated) ✅ |
| 상대방 메시지 | Soft Delete (deleted_for 추가) | 커스텀 이벤트 (chat-message-updated) ✅ |

---

## 🎯 결론

**문제**: Admin Client의 UPDATE와 DELETE 모두 Realtime 이벤트를 트리거하지 않음
**해결**: API 응답에 데이터 포함 + 커스텀 이벤트로 직접 상태 업데이트
**결과**: 페이지 새로고침 없이 실시간으로 이미지 삭제 완전 구현 ✅

### 핵심 교훈

1. **Service Role의 한계**: Admin Client는 강력하지만 Realtime 이벤트 전송 불가
2. **하이브리드 접근**: 커스텀 이벤트를 활용하여 완전한 실시간 경험 제공
3. **통일된 패턴**: Soft Delete와 Hard Delete 모두 커스텀 이벤트로 해결

---

## 📝 이미지 경고 메시지 설명

사용자가 언급한 경고 메시지:
```
Image with src "https://..." was detected as the Largest Contentful Paint (LCP).
Please add the "priority" property if this image is above the fold.
```

### 의미
- **LCP (Largest Contentful Paint)**: 페이지에서 가장 큰 콘텐츠 요소가 화면에 렌더링되는 시간
- 해당 이미지가 LCP로 감지되었는데 `priority` 속성이 없다는 경고
- 성능 최적화를 위한 Next.js의 권장사항

### 해결 방법
이미지가 화면 상단("above the fold")에 있다면:
```tsx
<Image
  src={imageUrl}
  alt="image"
  priority  // ✅ 추가
/>
```

### 영향
- ⚠️ 성능 경고일 뿐, 기능 동작에는 영향 없음
- 실시간 삭제 문제와는 무관
