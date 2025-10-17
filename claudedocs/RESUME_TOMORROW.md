# 내일 작업 재개 가이드

**날짜**: 2025-10-16 작성
**다음 세션 시작 시 읽을 것**

---

## 🎯 오늘의 작업 요약

### 완료한 작업
1. ✅ Share 기능 API 오류 수정 (400 → 200, 403 → 200)
2. ✅ 친구 선택 UI 개선 (bio 제거, 검색 기능 추가)
3. ✅ Delete 기능 props 전달 수정 (ReferenceError 해결)
4. ✅ Playwright MCP로 end-to-end 테스트 실행

### ⚠️ 사용자 피드백
> "지금 내가 의도한대로 되지 않았다"

→ **무엇이 의도대로 되지 않았는지 명확하지 않음**. 다음 세션에서 확인 필요.

---

## 📋 내일 시작 시 체크리스트

### 1단계: 상황 파악 (5분)
```bash
# 1. 상세 요약 문서 읽기
cat claudedocs/image-lightbox-testing-summary.md

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 직접 테스트
# http://localhost:3000/chat?room=a009a352-0548-49af-a223-acfd497965d6
```

### 2단계: 사용자에게 질문 (정확한 요구사항 파악)
다음 질문들을 사용자에게 물어볼 것:

**삭제 기능 관련**:
- Q: "삭제 버튼을 눌렀을 때, 채팅 목록에서 메시지가 즉시 사라졌나요?"
- Q: "아니면 새로고침을 해야 사라졌나요?"
- Q: "혹시 '메시지 정보가 없습니다' 오류가 여전히 나타나나요?"

**공유 기능 관련**:
- Q: "공유를 했을 때, 상대방 채팅방에 이미지가 제대로 전송되었나요?"
- Q: "이미지가 깨지거나 안 보이는 문제가 있나요?"

**친구 검색 관련**:
- Q: "친구 이름을 검색할 때 잘 작동하나요?"
- Q: "한글로 검색했을 때도 잘 되나요?"

**기타**:
- Q: "구체적으로 어떤 부분이 의도한대로 되지 않았나요?"

### 3단계: 문제 재현 및 디버깅

#### 시나리오 A: 삭제 후 메시지가 안 사라짐
**증상**: DELETE API는 성공(200)하는데 UI에서 메시지가 남아있음

**원인 추정**:
- TanStack Query 캐시 무효화 누락
- Realtime 구독에서 DELETE 이벤트 미처리

**해결 방법**:
```typescript
// src/components/shared/image-lightbox.tsx의 handleDelete 함수 수정
const handleDelete = async () => {
  // ... 기존 DELETE 로직 ...

  if (deleteRes.ok) {
    // 🔹 추가: 캐시 무효화
    queryClient.invalidateQueries(['chat-messages', roomId]);
    // 또는
    queryClient.setQueryData(['chat-messages', roomId], (old: any) => ({
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        data: page.data.filter((msg: any) => msg.id !== messageId)
      }))
    }));

    onClose();
  }
};
```

#### 시나리오 B: 공유된 이미지가 상대방에게 안 보임
**증상**: POST 요청은 성공하는데 상대방 채팅방에 이미지가 안 보임

**확인 사항**:
1. `/api/chat/messages` 라우트에서 file_url이 제대로 저장되는지
2. MessageRenderer에서 이미지 타입 메시지를 제대로 렌더링하는지
3. Storage 권한 문제는 없는지

**디버깅**:
```sql
-- Supabase에서 직접 확인
SELECT id, message_type, file_url, created_at
FROM chat_messages
WHERE room_id = 'room_id'
ORDER BY created_at DESC
LIMIT 5;
```

#### 시나리오 C: 친구 검색이 안 됨
**증상**: 검색창에 입력해도 필터링이 안 됨

**확인 사항**:
```typescript
// friend-selection-dialog.tsx:55-61 확인
const filteredFriends = useMemo(() => {
  if (!searchQuery.trim()) return friends;
  const query = searchQuery.toLowerCase();
  return friends.filter(friend =>
    friend.username.toLowerCase().includes(query)
  );
}, [friends, searchQuery]);
```

---

## 🛠️ 주요 파일 위치

### 수정한 파일
1. `src/components/shared/image-lightbox.tsx`
   - Lines 252-260: Share API 호출 (Zod 필드 추가)
   - Line 269: Room ID 추출 로직
   - Lines 624-666: ClickableImage props 인터페이스
   - Lines 703-717: ImageLightbox props 전달

2. `src/components/shared/friend-selection-dialog.tsx`
   - Line 5: Search import
   - Line 39: searchQuery state
   - Lines 54-61: filteredFriends 로직
   - Lines 110-120: 검색 UI
   - Lines 174-176: bio 제거

3. `src/components/chat/virtualized/MessageRenderer.tsx`
   - Lines 92-104: MessageContent props
   - Lines 141-149: ClickableImage props 전달
   - Lines 577-583: currentUserId 전달

### 관련 API
- `src/app/api/chat/messages/[messageId]/route.ts` - DELETE 엔드포인트
- `src/app/api/chat/messages/route.ts` - POST 엔드포인트
- `src/app/api/chat/rooms/route.ts` - 채팅방 생성

---

## 🔍 디버깅 명령어

```bash
# 서버 로그 실시간 확인
npm run dev 2>&1 | grep -E "(DELETE|POST) /api/chat"

# 특정 에러 검색
npm run dev 2>&1 | grep -E "(error|Error|ERROR)"

# Playwright 브라우저 테스트
# (이미 Playwright MCP 설정되어 있음)
```

### 브라우저 DevTools에서 확인
```javascript
// 1. Network 탭에서 API 요청 확인
// DELETE /api/chat/messages/[id] → 200 응답 확인

// 2. Console에서 Realtime 이벤트 확인
// "📨 New realtime message received" 로그

// 3. React DevTools Components 탭에서
// ImageLightbox props 확인
// - messageId, senderId, currentUserId, roomId 값이 있는지

// 4. TanStack Query Devtools에서
// ['chat-messages', roomId] 캐시 상태 확인
```

---

## 💡 추가 개선 아이디어

현재 작동하는 기능들이지만, 더 나은 UX를 위해:

1. **삭제 시 낙관적 업데이트 (Optimistic Update)**
   - 서버 응답을 기다리지 않고 즉시 UI에서 제거
   - 실패 시에만 롤백

2. **공유 진행 상태 표시**
   - "이미지 공유 중..." 로딩 인디케이터
   - 진행률 표시

3. **친구 검색 디바운싱**
   - 입력 중에는 검색하지 않고 0.3초 후에 검색
   - 성능 향상

4. **에러 메시지 개선**
   - "삭제에 실패했습니다. 다시 시도해주세요."
   - "공유할 수 없습니다. 네트워크를 확인해주세요."

---

## 📞 연락 사항

**프로젝트 정보**:
- 디렉토리: `/home/dandy02/possible/team_hub`
- Branch: `master`
- Modified files: `docs/FEATURES.md`

**테스트 환경**:
- URL: http://localhost:3000
- 테스트 계정: 주현규 (로그인 상태)
- 테스트 채팅방: 박할매 (ID: a009a352-0548-49af-a223-acfd497965d6)

**개발 서버**:
- Port: 3000
- Start: `npm run dev`
- Build: `npm run build`

---

## ✅ 다음 세션 목표

1. **사용자로부터 정확한 피드백 받기**
   - 무엇이 의도대로 안 되었는지 구체적으로 확인

2. **문제 재현 및 수정**
   - 위 시나리오 A/B/C 중 해당하는 것 찾아서 수정

3. **수동 테스트로 검증**
   - Share: 상대방 채팅방에서 이미지 확인
   - Delete: 메시지 목록에서 즉시 사라지는지 확인
   - Search: 친구 검색이 잘 되는지 확인

4. **완료 확인**
   - 사용자가 "잘 된다"고 확인할 때까지 반복

---

**📌 중요**: 이 문서와 `claudedocs/image-lightbox-testing-summary.md`를 함께 읽을 것!
