# 알려진 문제점 및 개선사항

**문서 업데이트**: 2025-10-17

---

## ✅ 최근 해결된 문제

### 0. Next.js Image Priority 및 Radix UI 접근성 경고 (2025-10-17)

**문제:** 콘솔에 2가지 경고 메시지가 지속적으로 표시됨

**증상:**
```
1. Image with src "..." was detected as the Largest Contentful Paint (LCP).
   Please add the "priority" property if this image is above the fold.

2. Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
```

**해결 방법:**

1. **LCP 이미지 Priority 설정** (MessageRenderer.tsx:136)
```tsx
// ❌ BEFORE
<ClickableImage
  priority={false}  // LCP 이미지에 false는 부적절
  ...
/>

// ✅ AFTER
<ClickableImage
  priority={true}  // LCP 이미지에 우선 로딩 활성화
  ...
/>
```

2. **Sheet Description 접근성 추가** (chat-attachment-menu.tsx)
```tsx
// ❌ BEFORE
<SheetHeader>
  <SheetTitle>파일 첨부</SheetTitle>
  {/* Description 누락 */}
</SheetHeader>

// ✅ AFTER
<SheetHeader>
  <SheetTitle>파일 첨부</SheetTitle>
  <SheetDescription className="sr-only">
    갤러리, 카메라, 파일, 위치 공유 등의 첨부 옵션을 선택할 수 있습니다.
  </SheetDescription>
</SheetHeader>
```

**개선 효과:**
- ✅ LCP 성능 최적화로 페이지 로딩 속도 개선
- ✅ 스크린 리더 사용자를 위한 접근성 향상
- ✅ Radix UI 접근성 권장사항 준수
- ✅ 콘솔 경고 완전 제거

**참고 문서:**
- Next.js 15.1.8: `priority` prop 공식 문서
- Radix UI Primitives: Dialog/Sheet Description 요구사항

**파일:**
- `src/components/chat/virtualized/MessageRenderer.tsx`
- `src/components/upload/chat-attachment-menu.tsx`

---

### 1. 모바일 파일 업로드 UI 버그 - 긴 파일명으로 전송 버튼 숨김 (2025-10-17)

**문제:** 모바일에서 긴 파일명(151자+)의 파일을 첨부하면 전송 버튼이 화면 밖으로 밀려나 메시지를 전송할 수 없음

**증상:**
- 파일 프리뷰가 화면 너비를 초과
- 전송 버튼(📤)이 오른쪽으로 완전히 숨겨짐
- 사용자가 메시지 전송 불가능 (치명적)

**테스트 환경:**
- Viewport: 375x667 (iPhone 6/7/8)
- 테스트 파일명: 151자 길이

**근본 원인:**
```tsx
// ❌ 이전 수정 실패 원인
<div className="mb-3 space-y-2">  {/* 부모 컨테이너 너비 제한 없음 */}
  <FilePreview className="max-w-[calc(100%-80px)]" />
  {/* calc(100%)는 부모의 자연스러운 너비 참조 → 무제한 확장 가능 */}
</div>
```

**해결 방법:**

**1단계: 부모 컨테이너 너비 제약** (chat-layout.tsx:581)
```tsx
// ✅ FIXED
<div className="mb-3 space-y-2 w-full overflow-hidden">
  {/* w-full: 뷰포트 너비 준수 */}
  {/* overflow-hidden: 콘텐츠가 컨테이너 확장 방지 */}
</div>
```

**2단계: FilePreview 컴포넌트** (file-upload-button.tsx:182-186)
```tsx
// ❌ BEFORE
<div className="flex items-center gap-2 p-2 bg-muted rounded-lg max-w-[calc(100%-80px)]">
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">{file.name}</p>
    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
  </div>
</div>

// ✅ AFTER
<div className="flex items-center gap-2 p-2 bg-muted rounded-lg w-full overflow-hidden">
  <span className="text-lg shrink-0">{getFileIcon(file.type)}</span>
  <div className="flex-1 min-w-0 overflow-hidden">
    <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
    <p className="text-xs text-muted-foreground truncate">{formatFileSize(file.size)}</p>
  </div>
  <Button className="h-6 w-6 p-0 shrink-0">×</Button>
</div>
```

**개선 효과:**
- ✅ 전송 버튼 항상 화면에 표시
- ✅ 긴 파일명 자동 말줄임(...) 처리
- ✅ 전체 파일명은 호버 시 툴팁으로 표시
- ✅ 모바일/데스크톱 모든 뷰포트에서 정상 작동

**교훈:**
- DevTools 시뮬레이션 ≠ 실제 모바일 디바이스
- `calc(100%)`는 부모의 자연스러운 너비 참조 (뷰포트 아님)
- Flexbox 너비 제약은 상위→하위로 계단식 적용 필요
- 모바일 레이아웃은 실제 기기 테스트 필수

**파일:**
- `src/components/chat/file-upload-button.tsx`
- `src/components/chat/chat-layout.tsx`

**관련 문서:**
- `/claudedocs/MOBILE_FILE_UPLOAD_FIX_SUMMARY.md`
- `/claudedocs/mobile-file-preview-fix-analysis.md`
- `/claudedocs/mobile-testing-checklist.md`

---

### 0. Realtime 재연결 시 메시지 유실 (2025-10-14)

**문제:** Realtime 연결이 끊겼다가 재연결되는 사이(1초)에 상대방이 보낸 메시지가 UI에 나타나지 않음

**증상:**
```
❌ Realtime channel error
🔌 Realtime connection closed
🔄 Reconnecting in 1000ms
✅ Realtime SUBSCRIBED
# 하지만 재연결 중에 보낸 메시지는 UI에 없음
```

**근본 원인:**
- Supabase Realtime의 postgres_changes는 실시간 이벤트만 구독
- 재연결 시 자동으로 과거 이벤트를 재전송하지 않음
- 따라서 연결이 끊긴 사이의 메시지는 영구적으로 UI에서 누락

**해결 방법:**
```typescript
// 1. API 엔드포인트에 'since' 파라미터 추가
GET /api/chat/messages?room_id={id}&since={timestamp}

// 2. use-chat.ts에 syncMessages 함수 추가
const syncMessages = useCallback(async (roomId: string) => {
  const lastMessage = messages[messages.length - 1];
  const since = lastMessage.created_at;

  const response = await fetch(
    `/api/chat/messages?room_id=${roomId}&since=${since}&limit=50`
  );

  // 중복 제거 후 병합
  const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id));
  setMessages(prev => [...prev, ...uniqueNewMessages]);
}, [currentRoom, messages]);

// 3. use-realtime-chat.ts 재연결 성공 시 동기화 트리거
.subscribe((status) => {
  if (status === 'SUBSCRIBED' && retryCountRef.current > 0) {
    onSyncNeeded(roomId); // 동기화 콜백 호출
  }
});
```

**개선 효과:**
- ✅ 재연결 중 메시지 유실 완전 방지
- ✅ 자동 동기화로 사용자 경험 개선
- ✅ 중복 방지 로직으로 안정성 확보
- ✅ Supabase 공식 패턴 준수

**파일:**
- `src/app/api/chat/messages/route.ts`
- `src/hooks/use-realtime-chat.ts`
- `src/hooks/use-chat.ts`

---

### 1. RealtimeStatus UI 혼란 제거 (2025-10-14)

**문제:** 채팅방 헤더의 "실시간/오프라인" 표시가 상대방 온라인 상태로 오해됨

**증상:**
- 상대방 닉네임 옆에 "실시간" 또는 "오프라인" 표시
- 실제로는 **내 Realtime 연결 상태**였으나 사용자가 상대방 상태로 착각

**문제점:**
- 사용자 기대: 상대방이 온라인인지 오프라인인지
- 실제 의미: 나의 WebSocket 연결 상태
- 위치: 상대방 닉네임 옆 → 더욱 혼란 가중

**해결 방법:**
```typescript
// chat-layout.tsx에서 RealtimeStatus 컴포넌트 완전 제거
- import { RealtimeStatus } from "./realtime-status";
- <RealtimeStatus ... />
```

**이유:**
- Realtime 연결 끊겨도 메시지 전송 가능 (HTTP API 사용)
- 자동 재연결 로직이 백그라운드에서 작동
- 사용자가 알 필요 없는 기술적 정보
- 혼란만 야기하고 실제 가치 없음

**파일:** `src/components/chat/chat-layout.tsx`

---

### 2. 로그인 시 불필요한 profiles POST 요청 (2025-10-14)

**문제:** 기존 계정 로그인 시 `POST /rest/v1/profiles => 404 Not Found` 에러 발생

**증상:**
```
[POST] https://vzrtznpmbanzjbfyjkcb.supabase.co/rest/v1/profiles => [404]
```

**근본 원인:**
- `auth-provider.tsx`에서 로그인할 때마다 `profiles.upsert({ id: session.user.id })`를 불필요하게 호출
- Database Trigger (`on_auth_user_created` → `handle_new_user()`)가 회원가입 시 자동으로 프로필 생성
- 이미 존재하는 프로필에 대해 중복 upsert 시도 → 404 에러

**영향:**
- ⚠️ 네트워크 낭비
- ⚠️ 성능 저하
- ⚠️ 에러 로그 오염

**해결 방법:**
```typescript
// src/components/auth-provider.tsx (lines 31-43)
if (event === "SIGNED_IN") {
  // session.user를 사용하여 상태 업데이트
  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? null,
      }
    : null;
  setUser(user);

  // 프로필은 Database Trigger (handle_new_user)가 회원가입 시 자동 생성하므로
  // 여기서 upsert 불필요 ← 중복 코드 제거!
}
```

**개선 효과:**
- ✅ 불필요한 POST 요청 완전 제거
- ✅ 로그인 시 네트워크 호출 최소화
- ✅ 404 에러 로그 제거
- ✅ Database Trigger 역할 명확화

**파일:** `src/components/auth-provider.tsx`

---

### 1. 익명 사용자 성능 메트릭 수집 실패 (2025-10-11)

**문제:** 로그아웃 상태에서 `/api/performance/metrics` 500 에러 발생

**증상:**
```
POST /api/performance/metrics => 500 Internal Server Error
Error: new row violates row-level security policy for table "performance_metrics"
```

**근본 원인:**
1. **주요 문제**: RLS 정책이 익명 사용자의 INSERT를 차단
2. **부차 문제**: `metric_type` CHECK 제약 조건이 소문자만 허용하는데 대문자로 전송

**해결 방법:**

1. Service Role Key 사용 (RLS 우회):
```typescript
// Service Role로 익명/로그인 사용자 모두 지원
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 로그인 사용자 확인 (선택적)
let user = null;
try {
  const serverClient = await createServerClient();
  const { data: { user: authUser } } = await serverClient.auth.getUser();
  user = authUser;
} catch {
  // 익명 사용자 - 무시
}

// user_id 처리
user_id: user?.id || null  // 로그인: UUID, 익명: null
```

2. metric_type 소문자 변환:
```typescript
metric_type: metric.type.toLowerCase()  // 'CLS' → 'cls'
```

**보안 계층:**
- ✅ Rate limiting (100 req/min per IP)
- ✅ Payload 검증 (sessionId, metrics 필수)
- ✅ Metric 형식 검증 (type, value, rating)
- ✅ Batch 크기 제한 (최대 20개)
- ✅ Service Role이지만 INSERT만 수행

**영향:**
- ✅ 익명 사용자: 메트릭 수집 가능 (user_id: null)
- ✅ 로그인 사용자: 메트릭 수집 + user_id 기록
- ✅ 관리자 조회: RLS 보호 유지

**파일:** `src/app/api/performance/metrics/route.ts`

---

### 1. SECURITY DEFINER 뷰 보안 문제 (2025-10-10)

**문제:** Supabase에서 보안 경고 - 뷰가 SECURITY DEFINER로 생성되어 RLS 우회

**영향받는 뷰:**
- `profiles_security_stats`
- `profiles_audit_stats`
- `unread_message_counts`

**위험성:**
```sql
-- SECURITY DEFINER (위험)
-- 뷰 생성자(postgres) 권한으로 실행 → RLS 우회
-- 일반 사용자가 모든 사용자 데이터 접근 가능!

CREATE VIEW profiles_security_stats AS
SELECT id, email, password_hash FROM profiles;
-- ⚠️ anon 사용자도 모든 프로필 조회 가능
```

**해결:**
```sql
-- SECURITY INVOKER (안전)
-- 쿼리 실행자 권한으로 실행 → RLS 정책 준수

CREATE VIEW profiles_security_stats
WITH (security_invoker = true)  -- ✅ Postgres 15+ 필수
AS
SELECT
  id,
  username,
  role,
  created_at
FROM profiles;

GRANT SELECT ON profiles_security_stats TO authenticated;
```

**마이그레이션:**
- 파일: `supabase/migrations/20251010000000_fix_security_definer_views.sql`
- 적용: `supabase db push` 또는 Supabase Dashboard에서 실행

**검증:**
```sql
-- security_invoker 확인
SELECT table_name, security_invoker
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('profiles_security_stats', 'profiles_audit_stats', 'unread_message_counts');
-- 결과: security_invoker = 'YES'
```

---

### 2. 위치 공유 지도 렌더링 완성 (2025-10-01)

**문제:** 지도 영역만 생성되고 카카오맵 SDK 초기화 없음

**해결:**
```typescript
const LocationMessage = memo(({ message, locationData }) => {
  useEffect(() => {
    const kakaoAPI = await loadKakaoMaps();
    const map = new kakaoAPI.maps.Map(container, options);
    const marker = new kakaoAPI.maps.Marker({ position, map });
  }, [message.id, locationData]);
});
```

---

### 3. 이미지 펜 캔버스 크기 문제 (2025-10-02)

**문제:** 그린 위치와 전송 후 위치 불일치

**해결:**
```typescript
// 실제 렌더링 크기 측정
const handleImageLoad = () => {
  const width = imageRef.current.offsetWidth;
  const height = imageRef.current.offsetHeight;
  setCanvasSize({ width, height });
};

// 스케일 비율 적용
const scaleX = img.width / canvasSize.width;
const scaleY = img.height / canvasSize.height;
ctx.scale(scaleX, scaleY);
```

---

### 4. DOMPurify XSS 보안 강화 (2025-10-02)

**문제:** `dangerouslySetInnerHTML` 사용으로 XSS 취약점

**해결:**
- `src/lib/sanitize.ts` 중앙화
- 게시물: 리치 HTML 안전하게 허용
- 채팅: TEXT_ONLY 모드

---

### 5. 이미지 편집 툴바 Event Propagation (2025-10-03)

**문제:** 버튼 클릭 시 부모 핸들러로 이벤트 전파

**해결:**
```typescript
onClick={(e) => {
  e.stopPropagation();  // 모든 툴바 버튼에 추가
  onClick?.();
}}
```

---

### 6. 펜 툴바 "전체 지우기" 미작동 (2025-10-04)

**문제:** state는 초기화되나 캔버스 픽셀 남아있음

**해결:**
```typescript
const handleClearAllDrawing = () => {
  setLines([]);

  layers.forEach((layer) => {
    layer.destroyChildren();  // 노드 제거
    layer.clear();             // 픽셀 클리어 ← 핵심!
    layer.draw();              // 재렌더링
  });
};
```

---

### 7. 채팅 읽지 않은 메시지 카운트 버그 (2025-10-16)

**문제:** 같은 채팅방 안에 있어도 메시지를 받으면 읽지 않은 카운트가 증가

**증상:**
- 주현규와 박할매가 같은 채팅방에서 대화 중
- 메시지를 보낼 때마다 상대방의 채팅방 리스트에 빨간 배지(1) 표시
- 채팅방 안에 있으므로 카운트가 증가하지 않아야 하는데 증가함

**근본 원인:**
```typescript
// ❌ 문제: 데이터 소스 불일치
// unread_message_counts 뷰: chat_room_participants.last_read_at 사용
// /api/chat/read API: message_reads 테이블에 저장
// → 읽음 처리를 해도 뷰가 반영하지 못함
```

**해결 방법:**

1. **데이터베이스 마이그레이션 확인:**
   ```bash
   # 마이그레이션 파일 확인
   ls -la supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql

   # 또는 Supabase Dashboard에서 확인
   # Settings → Database → Migrations
   ```

2. **마이그레이션 미적용 시:**
   ```bash
   # Supabase CLI로 적용
   npx supabase db push

   # 또는 Supabase Dashboard SQL Editor에서 직접 실행
   # MIGRATION_GUIDE.md 참조
   ```

3. **적용 확인:**
   ```sql
   -- unread_message_counts 뷰 확인
   SELECT * FROM unread_message_counts LIMIT 5;

   -- message_reads 테이블 데이터 확인
   SELECT * FROM message_reads ORDER BY updated_at DESC LIMIT 10;
   ```

4. **브라우저 캐시 삭제:**
   - Chrome: Ctrl+Shift+Delete
   - 또는 Hard Refresh: Ctrl+Shift+R

**검증 방법:**
1. 두 명의 사용자가 같은 채팅방 진입
2. 메시지 전송
3. 상대방 화면에서 채팅방 리스트 확인
4. ✅ 빨간 배지가 **나타나지 않아야** 함 (채팅방 안에 있으므로)

**관련 파일:**
- **마이그레이션**: `supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql`
- **가이드**: `MIGRATION_GUIDE.md` (자세한 수정 절차)
- **테스트**: `tests/manual/test-chat-unread.md` (수동 테스트)
- **E2E**: `tests/e2e/chat-unread-count.spec.ts` (자동화 테스트)

**해결 후 기대 결과:**
- ✅ 채팅방 안: 카운트 증가 안 함
- ✅ 채팅방 밖: 정확히 카운트 증가
- ✅ 읽음 처리 실시간 반영

---

## 🔴 높은 우선순위

### 8. 다중 파일 업로드 불완전

**현재 상태:**
```typescript
const handleFileSelect = (files: File[]) => {
  setSelectedFile(files[0]); // ⚠️ 첫 번째만 사용
};
```

**해결 방안:**
```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

const handleFileSelect = (files: File[]) => {
  setSelectedFiles(prev => [...prev, ...files].slice(0, 5));
};

// 순차 전송
for (const file of selectedFiles) {
  await sendMessage(content, roomId, file);
}
```

---

## 🟡 중간 우선순위

### 9. 타이핑 인디케이터 최적화

**현재 문제:** 매 호출마다 API 요청

**해결 방안:**
```typescript
const debouncedUpdateTyping = debounce(updateTyping, 500);

// 3초 후 자동 정지
const stopTypingTimer = useRef<NodeJS.Timeout>();
const updateTyping = () => {
  debouncedUpdateTyping();

  clearTimeout(stopTypingTimer.current);
  stopTypingTimer.current = setTimeout(() => {
    stopTyping();
  }, 3000);
};
```

---

### 10. 이미지 로딩 최적화

**현재:**
```typescript
<ClickableImage unoptimized={true} />  // ⚠️ 최적화 비활성화
```

**개선 방안:**
```typescript
<ClickableImage
  unoptimized={false}
  loading="lazy"
  placeholder="blur"
  quality={85}
/>
```

---

### 11. 읽음 표시 UI 미흡

**현재:** DB에 `read_by` 배열 있으나 UI 없음

**추가 권장:**
```typescript
{isOwnMessage && (
  <div className="text-xs text-muted-foreground">
    {(() => {
      const unreadCount = participants.length - message.read_by.length - 1;
      if (unreadCount === 0) return "읽음";
      return `${unreadCount}`;
    })()}
  </div>
)}
```

---

## 🟢 낮은 우선순위

### 12. 메시지 검색 기능
- 현재 게시물만 검색 가능
- 채팅 메시지 검색 필요

### 13. 메시지 편집/삭제 UI
- DB 로직 있음
- 사용자 인터페이스 미구현

### 14. 음성 메시지 지원
- 녹음 기능
- 오디오 플레이어

---

[← 데이터베이스](DATABASE.md) | [개발 가이드 →](DEVELOPMENT.md)
