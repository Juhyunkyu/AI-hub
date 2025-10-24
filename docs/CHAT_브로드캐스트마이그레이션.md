# Broadcast 전환 계획서

**문서 작성**: 2025-10-24
**목적**: postgres_changes → Broadcast 실시간 전환으로 성능 10배 개선
**상태**: 📋 **계획 단계** (롤백 경험 반영)

---

## 📋 목차

- [1. 왜 Broadcast인가?](#1-왜-broadcast인가)
- [2. 전환 로드맵](#2-전환-로드맵)
- [3. 하이브리드 전환 전략](#3-하이브리드-전환-전략)
- [4. 구현 체크리스트](#4-구현-체크리스트)
- [5. 테스트 계획](#5-테스트-계획)
- [6. 롤백 시나리오](#6-롤백-시나리오)

---

## 1. 왜 Broadcast인가?

### postgres_changes의 한계

현재 시스템([CHAT_CURRENT_IMPLEMENTATION.md](CHAT_CURRENT_IMPLEMENTATION.md) 참조)의 문제점:

| 문제 | 설명 | 영향 |
|------|------|------|
| **RLS 의존성** | Row Level Security 정책에 의존하여 권한 관리 복잡 | 디버깅 어려움 |
| **DB 부하** | 모든 변경사항이 DB를 통해 전파 | 스케일링 제한 |
| **지연시간** | DB 트리거 → Realtime → 클라이언트 경로 | 평균 500ms 지연 |
| **필터 복잡도** | 복잡한 SQL 필터 (`message_id=in.(select ...)`) | 성능 저하 |

**실제 측정 결과**:
```
메시지 전송 → DB INSERT (50ms)
→ postgres_changes 이벤트 (100ms)
→ Realtime 서버 전파 (200ms)
→ 클라이언트 수신 (150ms)
= 총 500ms 평균 지연
```

---

### Broadcast의 장점

| 장점 | 설명 | 예상 개선 |
|------|------|----------|
| **직접 통신** | DB 우회, 클라이언트 간 직접 메시지 전달 | 70% 부하 감소 |
| **낮은 지연** | WebSocket 직접 통신 | 50ms 이하 달성 |
| **확장성** | DB 부하 없이 수천 명 동시 접속 지원 | 100명 → 1000+ |
| **간단한 권한** | 채널 구독 시 RLS로 한 번만 검증 | 개발 단순화 |

**예상 플로우**:
```
사용자 A → sendMessage() → DB INSERT (50ms)
         ↓
         → Broadcast 전송 (즉시)
         ↓
사용자 B → 수신 (50ms 이내)
= 총 50-100ms 지연 (10배 향상)
```

---

## 2. 전환 로드맵

### Phase 1: 메시지 전송/수신 🔥 **최우선**

**대상 파일**: `src/hooks/use-realtime-chat.ts`
**난이도**: ⭐⭐⭐
**예상 시간**: 2-3시간
**예상 효과**: 메시지 속도 10배 향상, DB 읽기 부하 70% 감소

#### 현재 코드

```typescript
// use-realtime-chat.ts:186-199
const channel = supabase
  .channel(`room:${roomId}:messages`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chat_messages',
    filter: `room_id=eq.${roomId}`
  }, handleMessageChange)
  .subscribe();
```

#### 전환 후 코드

```typescript
// ✅ Broadcast 기반 실시간 (1차)
const channel = supabase
  .channel(`room:${roomId}:messages`, {
    config: { private: true }  // RLS 적용
  })
  // 1) Broadcast로 빠른 수신
  .on('broadcast', { event: 'new_message' }, (payload) => {
    const message = payload.payload;

    // 중복 방지
    if (processedMessagesRef.current.has(message.id)) return;
    processedMessagesRef.current.add(message.id);

    // UI 즉시 업데이트
    onNewMessage(message);
  })
  .on('broadcast', { event: 'update_message' }, (payload) => {
    onMessageUpdate(payload.payload);
  })
  .on('broadcast', { event: 'delete_message' }, (payload) => {
    onMessageDelete(payload.payload.message_id);
  })
  // 2) postgres_changes Fallback (재연결 동기화용)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chat_messages',
    filter: `room_id=eq.${roomId}`
  }, (payload) => {
    // Broadcast로 이미 받았으면 무시
    if (processedMessagesRef.current.has(payload.new?.id)) return;

    // 재연결 후 누락 메시지 처리
    handleMessageChange(payload);
  })
  .subscribe();
```

#### 메시지 전송 시 Broadcast

```typescript
// use-chat.ts의 sendMessage 함수 수정
const sendMessage = async (content: string, roomId: string) => {
  // 1. DB에 저장 (기존과 동일)
  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, content, sender_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // 2. ✅ Broadcast로 즉시 전송 (NEW!)
  const channel = supabase.channel(`room:${roomId}:messages`);
  await channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: {
      ...message,
      sender: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url
      }
    }
  });

  return message;
};
```

#### 주의사항

1. **중복 방지 강화**
   ```typescript
   // Broadcast + postgres_changes 둘 다 올 수 있음
   const processedMessagesRef = useRef(new Set());

   // 메시지 수신 시 항상 체크
   if (processedMessagesRef.current.has(messageId)) {
     console.log('중복 메시지 필터링:', messageId);
     return;
   }
   ```

2. **순서 보장**
   ```typescript
   // Broadcast는 순서 보장 안 됨 → 클라이언트에서 정렬
   const sortMessages = (messages: ChatMessage[]) => {
     return messages.sort((a, b) =>
       new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
     );
   };
   ```

3. **에러 처리**
   ```typescript
   try {
     await channel.send({ type: 'broadcast', ... });
   } catch (error) {
     console.error('Broadcast 실패, postgres_changes로 폴백:', error);
     // postgres_changes가 자동으로 처리함
   }
   ```

---

### Phase 2: Nav바 알림 📢

**대상 파일**: `src/hooks/use-notifications.ts`
**난이도**: ⭐⭐
**예상 시간**: 1-2시간
**예상 효과**: 알림 지연 1-2초 → 즉시, 배터리 소모 감소

#### 현재 코드

```typescript
// use-notifications.ts:200-228
channel
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages'
  }, (payload) => {
    if (payload.new.sender_id !== user.id) {
      scheduleInvalidateUnread(500);
    }
  })
```

#### 전환 후 코드

```typescript
// ✅ 전역 사용자 알림 채널
const channel = supabase
  .channel(`user:${user.id}:notifications`, {
    config: { private: true }
  })
  // Broadcast로 즉시 알림
  .on('broadcast', { event: 'new_message_notification' }, (payload) => {
    const { room_id, sender_id, message_preview } = payload.payload;

    // 자신의 메시지는 무시
    if (sender_id === user.id) return;

    // unread count 즉시 증가 (Optimistic Update)
    queryClient.setQueryData(['chat', 'unreadCount'], (prev) => ({
      ...prev,
      totalUnreadCount: prev.totalUnreadCount + 1,
      roomCounts: prev.roomCounts.map(r =>
        r.room_id === room_id
          ? { ...r, unreadCount: r.unreadCount + 1 }
          : r
      )
    }));

    // 토스트 알림 (선택)
    toast(`새 메시지: ${message_preview}`);
  })
  // Fallback: postgres_changes
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages'
  }, (payload) => {
    // Broadcast로 이미 처리했으면 무시
    scheduleInvalidateUnread(500);
  })
  .subscribe();
```

#### 메시지 전송 시 알림 Broadcast

```typescript
// sendMessage 함수에서 알림 브로드캐스트 추가
const sendMessage = async (content: string, roomId: string) => {
  // ... DB 저장 ...

  // 2. 메시지 Broadcast
  await roomChannel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: message
  });

  // 3. ✅ 알림 Broadcast (NEW!)
  // 채팅방 참여자들에게 알림
  const { data: participants } = await supabase
    .from('chat_room_participants')
    .select('user_id')
    .eq('room_id', roomId)
    .neq('user_id', user.id);  // 자신 제외

  // 각 참여자의 알림 채널에 브로드캐스트
  for (const participant of participants) {
    const notificationChannel = supabase.channel(`user:${participant.user_id}:notifications`);
    await notificationChannel.send({
      type: 'broadcast',
      event: 'new_message_notification',
      payload: {
        room_id: roomId,
        sender_id: user.id,
        message_preview: content.substring(0, 50)
      }
    });
  }
};
```

**최적화**: 참여자 목록을 캐싱하여 매번 DB 조회 방지

---

### Phase 3: 읽음 상태 ✅

**대상 파일**: `src/hooks/use-read-status.ts`
**난이도**: ⭐⭐⭐
**예상 시간**: 2-3시간
**예상 효과**: 읽음 카운트 업데이트 2-3초 → 즉시, DB 쿼리 부하 90% 감소

#### 현재 코드

```typescript
// use-read-status.ts:373-424
channel.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'chat_message_reads',
  filter: `message_id=in.(select id from chat_messages where room_id=eq.${roomId})`
}, async (payload) => {
  // 복잡한 SQL 필터 + RPC 호출
  const { data: count } = await supabase.rpc('get_unread_count_kakao_style', {
    p_message_id: payload.new.message_id
  });
  // ...
});
```

#### 전환 후 코드

```typescript
// ✅ Broadcast 기반 읽음 상태
const channel = supabase
  .channel(`room:${roomId}:read_status`, {
    config: { private: true }
  })
  // Broadcast로 즉시 읽음 상태 수신
  .on('broadcast', { event: 'read_update' }, (payload) => {
    const { message_id, user_id, unread_count } = payload.payload;

    // 다른 사용자의 읽음만 처리
    if (user_id !== currentUser.id) {
      // UI 즉시 업데이트 (RPC 호출 없이!)
      setReadStatusMap(prev => new Map(prev.set(message_id, {
        message_id,
        user_id,
        unread_count
      })));
    }
  })
  // Fallback: postgres_changes
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chat_message_reads',
    filter: `message_id=in.(select id from chat_messages where room_id=eq.${roomId})`
  }, async (payload) => {
    // 재연결 후 동기화용
  })
  .subscribe();
```

#### 읽음 처리 시 Broadcast

```typescript
const markMessageAsRead = async (messageId: string) => {
  // 1. DB에 저장 (기존)
  await supabase.rpc('mark_message_as_read_optimized', {
    p_message_id: messageId
  });

  // 2. ✅ Broadcast 전송 (NEW!)
  const channel = supabase.channel(`room:${roomId}:read_status`);

  // 최신 읽음 카운트 계산 (클라이언트에서!)
  const participants = currentRoom.participants.length;
  const readBy = await getReadByCount(messageId);
  const unreadCount = participants - 1 - readBy;  // 발신자 제외

  await channel.send({
    type: 'broadcast',
    event: 'read_update',
    payload: {
      message_id: messageId,
      user_id: currentUser.id,
      unread_count: unreadCount
    }
  });
};
```

**최적화**: 읽음 카운트를 클라이언트에서 계산하여 RPC 호출 제거

---

### Phase 4: SSE 제거 🗑️

**대상 파일**: `src/app/api/chat/events/route.ts`
**난이도**: ⭐
**예상 시간**: 30분

```bash
# 파일 삭제
rm src/app/api/chat/events/route.ts
```

**이유**: 클라이언트에서 직접 Realtime 사용하므로 SSE 엔드포인트 불필요

---

## 3. 하이브리드 전환 전략 (권장 ✅)

### 개념

**Broadcast를 1차, postgres_changes를 Fallback으로 사용**하여:
- ✅ 빠른 업데이트는 Broadcast
- ✅ 재연결/동기화는 postgres_changes
- ✅ 점진적 전환 가능 (일부 기능만 먼저 전환)

### 구현 패턴

```typescript
// 모든 실시간 구독에 적용
const channel = supabase
  .channel(channelName, { config: { private: true } })

  // 1차: Broadcast (빠름)
  .on('broadcast', { event: 'your_event' }, (payload) => {
    handleFast(payload);
  })

  // 2차: postgres_changes (안정성)
  .on('postgres_changes', { ... }, (payload) => {
    // 이미 Broadcast로 받았으면 무시
    if (alreadyProcessed(payload)) return;

    // 재연결 후 누락 데이터 처리
    handleFallback(payload);
  })

  .subscribe();
```

### 이중 처리 방지

```typescript
// 공통 중복 방지 로직
const useDeduplication = (ttl = 5000) => {
  const processedRef = useRef(new Map<string, number>());

  const markProcessed = (id: string) => {
    processedRef.current.set(id, Date.now());
  };

  const isProcessed = (id: string) => {
    const timestamp = processedRef.current.get(id);
    if (!timestamp) return false;

    // TTL 지난 항목은 삭제
    if (Date.now() - timestamp > ttl) {
      processedRef.current.delete(id);
      return false;
    }

    return true;
  };

  return { markProcessed, isProcessed };
};
```

---

## 4. 구현 체크리스트

### Phase 1: 메시지 전송/수신

- [ ] `use-realtime-chat.ts` Broadcast 리스너 추가
- [ ] `use-chat.ts` sendMessage에 Broadcast 전송 추가
- [ ] 중복 방지 로직 강화
- [ ] 메시지 순서 정렬 로직 추가
- [ ] 에러 처리 및 Fallback 구현
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 실행
- [ ] 로컬 환경에서 검증 (2명 동시 접속)
- [ ] 네트워크 끊김 시나리오 테스트
- [ ] 프로덕션 배포 (카나리)

### Phase 2: Nav바 알림

- [ ] `use-notifications.ts` Broadcast 리스너 추가
- [ ] sendMessage에 알림 Broadcast 추가
- [ ] 참여자 목록 캐싱 구현
- [ ] Optimistic Update 로직 검증
- [ ] 토스트 알림 추가 (선택)
- [ ] 테스트: 다른 방에서 메시지 수신 시 알림 확인
- [ ] 테스트: 현재 방에서는 알림 안 뜨는지 확인
- [ ] 프로덕션 배포

### Phase 3: 읽음 상태

- [ ] `use-read-status.ts` Broadcast 리스너 추가
- [ ] markMessageAsRead Broadcast 전송 추가
- [ ] 클라이언트 읽음 카운트 계산 로직
- [ ] RPC 호출 최소화
- [ ] 테스트: 읽음 카운트 실시간 감소 확인
- [ ] 테스트: 여러 명 동시 읽을 때 정확성 확인
- [ ] 프로덕션 배포

### Phase 4: SSE 제거

- [ ] `src/app/api/chat/events/route.ts` 삭제
- [ ] 관련 타입 정의 정리
- [ ] 사용하지 않는 코드 제거

---

## 5. 테스트 계획

### 단위 테스트

```typescript
// tests/unit/broadcast-deduplication.test.ts
describe('Broadcast 중복 방지', () => {
  it('같은 메시지 ID가 두 번 오면 무시', () => {
    const { markProcessed, isProcessed } = useDeduplication();

    markProcessed('msg-123');
    expect(isProcessed('msg-123')).toBe(true);
  });

  it('TTL 후에는 다시 처리 가능', async () => {
    const { markProcessed, isProcessed } = useDeduplication(1000);

    markProcessed('msg-123');
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(isProcessed('msg-123')).toBe(false);
  });
});
```

---

### E2E 테스트

```typescript
// tests/e2e/broadcast-realtime.spec.ts
test('Broadcast로 메시지 즉시 수신', async ({ page, context }) => {
  const pageA = page;
  const pageB = await context.newPage();

  // 두 사용자 모두 같은 방 입장
  await pageA.goto('/chat?room=test-room');
  await pageB.goto('/chat?room=test-room');

  // 사용자 A가 메시지 전송
  const startTime = Date.now();
  await pageA.fill('[data-testid="message-input"]', 'Broadcast Test');
  await pageA.click('[data-testid="send-button"]');

  // 사용자 B에서 즉시 수신 확인
  await expect(pageB.locator('text=Broadcast Test')).toBeVisible();
  const endTime = Date.now();

  // 100ms 이내 수신 확인
  expect(endTime - startTime).toBeLessThan(100);
});
```

---

### 부하 테스트

```typescript
// tests/load/broadcast-performance.test.ts
test('100명 동시 접속 시 메시지 전달', async () => {
  const users = Array.from({ length: 100 }, (_, i) => createUser(i));

  // 모든 사용자가 같은 방 구독
  await Promise.all(users.map(u => u.joinRoom('load-test-room')));

  // 한 사용자가 메시지 전송
  const startTime = Date.now();
  await users[0].sendMessage('Load test message');

  // 나머지 99명이 모두 수신할 때까지 대기
  const receivedCount = await waitForAllReceived(users, 'Load test message');

  expect(receivedCount).toBe(99);
  expect(Date.now() - startTime).toBeLessThan(1000); // 1초 이내
});
```

---

## 6. 롤백 시나리오

### 롤백 트리거

다음 경우 즉시 롤백:
- ❌ 메시지 누락률 > 1%
- ❌ 평균 지연시간 > 기존 postgres_changes (500ms)
- ❌ 중복 메시지 발생률 > 5%
- ❌ 에러율 > 0.1%

### 롤백 방법

**하이브리드 전환의 장점**: Broadcast를 비활성화하면 자동으로 postgres_changes로 폴백

```typescript
// 긴급 롤백: 환경 변수로 제어
const USE_BROADCAST = process.env.NEXT_PUBLIC_USE_BROADCAST === 'true';

const channel = supabase
  .channel(channelName)

  // Broadcast (조건부)
  ...(USE_BROADCAST && [
    .on('broadcast', { event: 'new_message' }, handler)
  ])

  // postgres_changes (항상 활성)
  .on('postgres_changes', { ... }, fallbackHandler)

  .subscribe();
```

**롤백 절차**:
1. 환경 변수 `NEXT_PUBLIC_USE_BROADCAST=false` 설정
2. 프론트엔드 재배포 (1분)
3. postgres_changes로 자동 복구
4. 모니터링 확인

---

## 7. 예상 성과

| 지표 | 현재 (postgres_changes) | 목표 (Broadcast) | 개선율 |
|------|------------------------|-----------------|--------|
| 메시지 전달 속도 | 500ms | 50ms | **10배 ↑** |
| DB 읽기 부하 | 높음 | 낮음 | **70% ↓** |
| 동시 접속자 | ~100명 | 1000+ | **10배 ↑** |
| 네트워크 재연결 | 2-5초 | 1-2초 | **2배 ↑** |
| 읽음 상태 업데이트 | 1-2초 | 즉시 | **즉시 ✅** |
| 알림 지연 | 1-2초 | 즉시 | **즉시 ✅** |

---

## 8. 타임라인

| 주차 | Phase | 작업 내용 | 소요 시간 |
|------|-------|----------|----------|
| 1주차 | Phase 1 | 메시지 전송/수신 Broadcast 전환 | 2-3시간 |
|  | 테스트 | 단위 + E2E 테스트 | 1-2시간 |
| 2주차 | Phase 2 | Nav바 알림 Broadcast 전환 | 1-2시간 |
|  | Phase 3 | 읽음 상태 Broadcast 전환 | 2-3시간 |
| 3주차 | Phase 4 | SSE 제거 및 최적화 | 1시간 |
|  | 검증 | 부하 테스트 및 프로덕션 배포 | 2시간 |

**총 예상 시간**: 9-13시간 (약 2-3주)

---

## 다음 단계

1. ✅ 이 문서 검토 및 승인
2. 📋 Phase 1 시작: [체크리스트](#phase-1-메시지-전송수신) 따라 진행
3. 🧪 로컬 환경에서 충분히 테스트
4. 🚀 카나리 배포 → 전체 배포

**질문이나 우려사항이 있으면** 이 문서에 코멘트를 남기거나 새 세션에서 참조하세요!

---

[← 현재 구현](CHAT_CURRENT_IMPLEMENTATION.md) | [메인 문서 →](CHAT_SYSTEM.md)
