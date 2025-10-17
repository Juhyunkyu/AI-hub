# 실시간 이미지 삭제 문제 해결 방안

**작성일**: 2025-10-17
**버전**: 4.0 - RLS WITH CHECK 충돌 문제 해결
**상태**: ✅ 완전 해결 (모든 Soft Delete 시나리오)

---

## 📋 문제 요약

### v4.0 문제 (2025-10-17 최종 발견)
- **일반 사용자가 상대방 메시지 삭제 시 500 에러 발생**
- 에러: `new row violates row-level security policy for table "chat_messages"` (42501)
- 일반 Client로 UPDATE 시도 → RLS WITH CHECK 실패

### 근본 원인 (v4.0)

**RLS SELECT 정책과 WITH CHECK 절의 충돌**

#### 상황 설명
1. 사용자가 메시지를 삭제하면 `deleted_for` 배열에 자신의 ID를 추가
2. UPDATE 실행
3. **WITH CHECK 검증** 단계에서 Postgres가 업데이트된 row를 다시 조회
4. 하지만 **SELECT RLS 정책**에 의해 해당 row가 보이지 않음:
   ```sql
   SELECT 정책: NOT (auth.uid() = ANY (deleted_for))
   ```
5. **WITH CHECK 실패** → RLS 42501 에러

#### 코드 증거

**AS-IS (문제 있는 코드)**:
```typescript
// 일반 Client로 상대방 메시지 Soft Delete 시도
const { error: softDeleteError } = await supabase  // ❌ RLS WITH CHECK 실패
  .from("chat_messages")
  .update({ deleted_for: updatedDeletedFor })
  .eq("id", messageId);

// 에러 발생:
// {
//   "code": "42501",
//   "message": "new row violates row-level security policy"
// }
```

**TO-BE (해결된 코드)**:
```typescript
// Admin Client로 모든 Soft Delete 작업 수행
const { error: softDeleteError } = await supabaseAdmin  // ✅ RLS 우회
  .from("chat_messages")
  .update({ deleted_for: updatedDeletedFor })
  .eq("id", messageId);
```

---

## ✅ 해결 방법

### v4.0 최종 해결책: 모든 Soft Delete에 Admin Client 사용

#### 왜 Admin Client를 사용해야 하나요?

**문제의 핵심**:
- 사용자가 `deleted_for`에 추가되면 즉시 SELECT 정책에 의해 메시지가 보이지 않음
- Postgres의 WITH CHECK는 UPDATE 후 row를 다시 조회하여 검증
- 일반 Client는 자신에게 안 보이는 row를 UPDATE할 수 없음

**해결책**:
- Admin Client는 RLS를 우회하므로 WITH CHECK 제약을 받지 않음
- 커스텀 이벤트로 Realtime 기능 대체

#### 서버 측 수정 (`route.ts`)

**1. 상대방 메시지 삭제 (Soft Delete)**

```typescript
// 📌 상대방이 보낸 메시지인 경우 → Soft Delete만 가능
if (message.sender_id !== user.id) {
  console.log("💡 Deleting other's message - Soft Delete");

  // 이미 삭제되어 있는지 확인
  if (message.deleted_for?.includes(user.id)) {
    return NextResponse.json(
      { error: "Message already deleted" },
      { status: 400 }
    );
  }

  // Soft Delete: 본인만 안 보이게
  // ⚠️ Admin Client 사용 이유:
  //    사용자가 deleted_for에 추가되면 SELECT RLS에 의해 메시지가 안 보이게 됨
  //    이 경우 일반 Client UPDATE의 WITH CHECK가 실패함 (업데이트된 row를 볼 수 없음)
  const currentDeletedFor = message.deleted_for || [];
  const updatedDeletedFor = [...currentDeletedFor, user.id];

  const { error: softDeleteError } = await supabaseAdmin  // ✅ Admin Client
    .from("chat_messages")
    .update({ deleted_for: updatedDeletedFor })
    .eq("id", messageId);

  if (softDeleteError) {
    console.error("❌ Soft delete error details:", JSON.stringify(softDeleteError, null, 2));
    return NextResponse.json(
      { error: "Failed to delete message", details: softDeleteError.message },
      { status: 500 }
    );
  }

  console.log("✅ Soft delete successful");

  // 업데이트된 메시지 조회 (커스텀 이벤트용)
  const { data: updatedMessage } = await supabaseAdmin  // ✅ Admin Client로 조회
    .from("chat_messages")
    .select("*")
    .eq("id", messageId)
    .single();

  return NextResponse.json({
    success: true,
    delete_type: "soft",
    message: "Message hidden for you",
    updated_message: updatedMessage, // ✅ 커스텀 이벤트용
  });
}
```

**2. 본인 메시지 삭제 - 읽음 상태 확인 실패 시 (Soft Delete)**

```typescript
if (readsError) {
  console.error("Error checking read status:", readsError);
  // 읽음 상태 확인 실패 시 안전하게 소프트 삭제
  // ⚠️ 송신자가 자신의 메시지를 숨기는 경우, Admin Client 사용
  const currentDeletedFor = message.deleted_for || [];
  const updatedDeletedFor = [...currentDeletedFor, user.id];

  const { error: softDeleteError } = await supabaseAdmin  // ✅ Admin Client
    .from("chat_messages")
    .update({ deleted_for: updatedDeletedFor })
    .eq("id", messageId);

  if (softDeleteError) {
    console.error("❌ Soft delete error (reads check failed):", JSON.stringify(softDeleteError, null, 2));
    return NextResponse.json(
      { error: "Failed to delete message", details: softDeleteError.message },
      { status: 500 }
    );
  }

  console.log("✅ Soft delete successful (reads check failed)");

  // 업데이트된 메시지 조회 (커스텀 이벤트용)
  const { data: updatedMessage } = await supabaseAdmin  // ✅ Admin Client
    .from("chat_messages")
    .select("*")
    .eq("id", messageId)
    .single();

  return NextResponse.json({
    success: true,
    delete_type: "soft",
    message: "Message hidden for you",
    updated_message: updatedMessage, // ✅ 커스텀 이벤트용
  });
}
```

**3. 본인 메시지 삭제 - 상대방이 읽음 (Soft Delete)**

```typescript
if (hasBeenReadByOthers) {
  // 🔹 Soft Delete: 다른 참여자가 읽었으면 본인만 안 보이게
  // ⚠️ 송신자가 자신의 메시지를 숨기는 경우, Admin Client 사용
  // 이유: 송신자가 deleted_for에 자신을 추가하면 RLS SELECT 정책에 의해 메시지가 보이지 않게 됨
  //       이 경우 일반 Client UPDATE는 RLS 위반으로 차단됨 (WITH CHECK 실패)
  console.log("💡 Own message read by others - Soft Delete (Admin Client)");
  const currentDeletedFor = message.deleted_for || [];
  const updatedDeletedFor = [...currentDeletedFor, user.id];

  const { error: softDeleteError } = await supabaseAdmin  // ✅ Admin Client
    .from("chat_messages")
    .update({ deleted_for: updatedDeletedFor })
    .eq("id", messageId);

  if (softDeleteError) {
    console.error("❌ Soft delete error (read by others):", JSON.stringify(softDeleteError, null, 2));
    return NextResponse.json(
      { error: "Failed to delete message", details: softDeleteError.message },
      { status: 500 }
    );
  }

  console.log("✅ Soft delete successful (own message read by others)");

  // 업데이트된 메시지 조회 (커스텀 이벤트용)
  const { data: updatedMessage } = await supabaseAdmin  // ✅ Admin Client
    .from("chat_messages")
    .select("*")
    .eq("id", messageId)
    .single();

  return NextResponse.json({
    success: true,
    delete_type: "soft",
    message: "Message hidden for you (others have read it)",
    updated_message: updatedMessage, // ✅ 커스텀 이벤트용
  });
}
```

#### 클라이언트 측 (변경 없음)

**`image-lightbox.tsx`**:
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
  } else if (result.delete_type === 'hard') {
    toast.success('메시지가 삭제되었습니다');

    // ✅ Hard Delete는 Admin Client 사용으로 Realtime 이벤트가 트리거되지 않으므로
    // API 응답의 deleted_message_id로 직접 삭제 처리
    if (result.deleted_message_id) {
      window.dispatchEvent(new CustomEvent('chat-message-deleted', {
        detail: { messageId: result.deleted_message_id }
      }));
    }
  }

  onClose();
}
```

**`use-chat.ts`** (변경 없음):
```typescript
// ✅ Soft Delete 커스텀 이벤트 수신 (Admin Client UPDATE - Realtime 이벤트가 도달하지 않음)
useEffect(() => {
  const handleCustomUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<ChatMessage>;
    const updatedMessage = customEvent.detail;

    if (process.env.NODE_ENV === 'development') {
      console.log('📨 Custom message update event received:', updatedMessage.id);
    }

    // handleMessageUpdate를 통해 처리 (Soft Delete 필터링 포함)
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

### Soft Delete (모든 시나리오)

```
1. 사용자가 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. Admin Client로 deleted_for 배열에 사용자 ID 추가 (UPDATE)
   ✅ RLS 우회 - WITH CHECK 제약 없음
   ↓
4. Admin Client로 업데이트된 메시지 조회
   ↓
5. API 응답에 updated_message 포함
   ↓
6. 클라이언트가 커스텀 이벤트 발생 (chat-message-updated)
   ↓
7. use-chat.ts에서 이벤트 수신
   ↓
8. handleMessageUpdate 호출
   ↓
9. deleted_for 배열에 현재 사용자 포함 → 메시지 필터링
   ↓
10. UI에서 즉시 제거 ✅
```

### Hard Delete (본인 메시지 - 읽지 않음)

```
1. 사용자가 삭제 버튼 클릭
   ↓
2. DELETE API 호출
   ↓
3. 읽음 상태 확인 → 아무도 안 읽음
   ↓
4. Storage에서 파일 삭제 (있는 경우)
   ↓
5. message_reads 참조 제거
   ↓
6. Admin Client로 DB에서 메시지 DELETE
   ↓
7. API 응답에 deleted_message_id 포함
   ↓
8. 클라이언트가 커스텀 이벤트 발생 (chat-message-deleted)
   ↓
9. use-chat.ts에서 이벤트 수신
   ↓
10. handleMessageDelete 호출
   ↓
11. UI에서 즉시 제거 ✅
```

---

## 🧪 테스트 방법

### 1. 상대방 메시지 Soft Delete 테스트

1. 주현규(User A) 계정으로 이미지 전송
2. 박할매(User B) 계정으로 로그인
3. 주현규의 이미지 삭제 클릭
4. 콘솔 로그 확인:
   ```
   🔍 DELETE request for messageId: xxx
   💡 Deleting other's message - Soft Delete
   ✅ Soft delete successful
   📨 Custom message update event received: xxx
   🗑️ Message xxx soft deleted for current user, removing from UI
   ```
5. ✅ 새로고침 없이 이미지가 즉시 사라짐
6. 주현규 계정에서는 여전히 이미지가 보임 (Soft Delete)

### 2. 본인 메시지 Soft Delete 테스트 (상대방이 읽음)

1. 박할매 계정으로 이미지 전송
2. 주현규 계정에서 메시지 읽음 (읽음 표시 확인)
3. 박할매 계정으로 자신의 이미지 삭제
4. 콘솔 로그 확인:
   ```
   💡 Own message read by others - Soft Delete (Admin Client)
   ✅ Soft delete successful (own message read by others)
   📨 Custom message update event received: xxx
   ```
5. ✅ 박할매 화면에서만 사라짐
6. 주현규 화면에는 여전히 보임

### 3. 본인 메시지 Hard Delete 테스트 (아무도 안 읽음)

1. 박할매 계정으로 이미지 전송
2. 주현규가 읽기 전에 박할매가 삭제
3. 콘솔 로그 확인:
   ```
   💡 No one read - Hard Delete path
   ✅ Storage file deleted successfully
   ✅ Message deleted from DB successfully
   🗑️ Custom message delete event received: xxx
   ```
4. ✅ 양쪽 화면에서 모두 사라짐 (Hard Delete)

---

## 📊 구현 파일 목록

### v4.0 수정된 파일

**`src/app/api/chat/messages/[messageId]/route.ts`**
- **Line 70**: `supabase` → `supabaseAdmin` (상대방 메시지 Soft Delete)
- **Line 86**: `supabase` → `supabaseAdmin` (업데이트된 메시지 조회)
- **Line 142**: `supabaseAdmin` 사용 (읽음 확인 실패 시 Soft Delete) - 기존 코드
- **Line 158**: `supabaseAdmin` 사용 (조회) - 기존 코드
- **Line 189**: `supabaseAdmin` 사용 (본인 메시지 읽음 후 Soft Delete) - 기존 코드
- **Line 205**: `supabaseAdmin` 사용 (조회) - 기존 코드

### 변경 없는 파일

- **`src/components/shared/image-lightbox.tsx`**: 커스텀 이벤트 발생 (기존 코드)
- **`src/hooks/use-chat.ts`**: 커스텀 이벤트 수신 및 처리 (기존 코드)

---

## ⚠️ 주의사항

### 1. RLS WITH CHECK 제약

**문제**: 일반 Client로 `deleted_for` UPDATE 시:
- UPDATE 전: 메시지가 보임 (SELECT 정책 통과)
- UPDATE 후: `deleted_for`에 자신 추가 → SELECT 정책 위반
- WITH CHECK: UPDATE 후 row 조회 시도 → 안 보임 → 실패

**해결**: Admin Client 사용으로 RLS 우회

### 2. Admin Client와 Realtime

**제약**:
- Admin Client (Service Role)로 UPDATE/DELETE 시 Realtime 이벤트가 클라이언트에 전달되지 않음

**해결**:
- 모든 삭제 작업에 커스텀 이벤트 사용
- API 응답에 `updated_message` 또는 `deleted_message_id` 포함

### 3. 삭제 로직 요약

| 상황 | 동작 | Client | 이벤트 방식 |
|------|------|--------|------------|
| 상대방 메시지 삭제 | Soft Delete | Admin | 커스텀 이벤트 (chat-message-updated) |
| 본인 메시지 + 읽음 | Soft Delete | Admin | 커스텀 이벤트 (chat-message-updated) |
| 본인 메시지 + 미읽음 | Hard Delete | Admin | 커스텀 이벤트 (chat-message-deleted) |

**모든 경우에 Admin Client 사용** → RLS 제약 우회 → 커스텀 이벤트로 실시간 처리

---

## 🎯 결론

### v4.0 최종 해결책

**문제**: RLS SELECT 정책이 Soft Delete UPDATE의 WITH CHECK와 충돌
**원인**: `deleted_for`에 추가되면 SELECT 정책 위반 → WITH CHECK 검증 실패
**해결**: 모든 Soft Delete에 Admin Client 사용 → RLS 우회 → 커스텀 이벤트로 실시간 처리
**결과**: 페이지 새로고침 없이 모든 삭제 시나리오에서 실시간 동작 ✅

### 핵심 교훈

1. **RLS WITH CHECK의 함정**: UPDATE 후 row가 SELECT 정책을 만족해야 함
2. **Admin Client의 역할**: RLS 제약을 우회하여 복잡한 권한 문제 해결
3. **커스텀 이벤트의 필요성**: Admin Client 작업은 Realtime을 트리거하지 않으므로 대체 메커니즘 필요
4. **일관된 패턴**: 모든 삭제 작업을 동일한 방식으로 처리하여 유지보수성 향상

---

## 📝 버전 히스토리

- **v1.0**: 초기 Admin Client 문제 발견
- **v2.0**: 커스텀 이벤트로 Soft Delete 해결
- **v3.0**: Hard Delete 커스텀 이벤트 추가
- **v4.0**: RLS WITH CHECK 충돌 발견 및 해결 (모든 Soft Delete에 Admin Client 적용)
