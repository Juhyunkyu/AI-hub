# 🔧 채팅방 읽지 않은 메시지 카운트 버그 수정 가이드

## 📌 문제 요약

**증상**: 채팅방 안에 있어도 읽지 않은 메시지 카운트(빨간 동그라미)가 증가함

**근본 원인**:
- ❌ `unread_message_counts` 뷰: `chat_room_participants.last_read_at` 사용
- ✅ `/api/chat/read` API: `message_reads` 테이블에 저장

→ 읽음 처리를 해도 뷰가 반영하지 못함!

---

## 🛠️ 해결 방법

### 방법 1: Supabase Dashboard에서 직접 실행 (추천)

1. **Supabase Dashboard 접속**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new
   ```

2. **SQL 에디터 열기**
   - 좌측 메뉴 → "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **마이그레이션 SQL 복사 & 실행**
   ```sql
   -- ✅ FIX: unread_message_counts 뷰를 message_reads 테이블 기반으로 수정

   -- 기존 뷰 삭제
   DROP VIEW IF EXISTS public.unread_message_counts;

   -- ✅ message_reads 테이블 기반으로 재작성
   CREATE VIEW public.unread_message_counts
   WITH (security_invoker = true)
   AS
   SELECT
     crp.room_id,
     crp.user_id,
     cr.name AS room_name,
     cr.updated_at AS latest_message_time,
     COUNT(cm.id) AS unread_count
   FROM chat_room_participants crp
   JOIN chat_rooms cr ON cr.id = crp.room_id
   -- ✅ message_reads 테이블 LEFT JOIN
   LEFT JOIN message_reads mr
     ON mr.room_id = crp.room_id
     AND mr.user_id = crp.user_id
   -- 읽지 않은 메시지만 카운트
   LEFT JOIN chat_messages cm
     ON cm.room_id = crp.room_id
     AND cm.created_at > COALESCE(mr.last_read_at, '1970-01-01'::timestamptz)
     AND cm.sender_id != crp.user_id
   GROUP BY crp.room_id, crp.user_id, cr.name, cr.updated_at;

   -- 권한 부여
   GRANT SELECT ON public.unread_message_counts TO authenticated;

   -- 성능 최적화 인덱스
   CREATE INDEX IF NOT EXISTS idx_message_reads_room_user
     ON message_reads(room_id, user_id);

   CREATE INDEX IF NOT EXISTS idx_message_reads_last_read_at
     ON message_reads(last_read_at);
   ```

4. **"RUN" 버튼 클릭**

5. **성공 확인**
   ```sql
   -- 뷰가 제대로 생성되었는지 확인
   SELECT * FROM unread_message_counts LIMIT 5;
   ```

---

### 방법 2: Supabase CLI 사용

```bash
# 프로젝트 링크 (처음만)
npx supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 적용
npx supabase db push

# 또는 직접 마이그레이션 파일 실행
npx supabase db execute \
  supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql
```

---

### 방법 3: psql로 직접 연결

```bash
# Supabase Dashboard에서 연결 정보 복사
# Settings → Database → Connection string (Direct connection)

psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# SQL 파일 실행
\i supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql
```

---

## ✅ 검증 방법

### 1. 브라우저에서 확인

1. **두 개의 브라우저/시크릿 모드 준비**
   - 브라우저 1: 주현규 로그인
   - 브라우저 2: 박할매 로그인

2. **두 사용자 모두 같은 채팅방 진입**

3. **주현규가 메시지 전송**
   ```
   메시지: "안녕하세요!"
   ```

4. **박할매 화면 확인**
   - ✅ 메시지가 실시간으로 보임
   - ✅ 채팅방 리스트의 빨간 동그라미: **없음** (0)
   - ✅ 헤더 네비게이션의 빨간 점: **없음**

### 2. SQL 쿼리로 직접 확인

```sql
-- 1. message_reads 테이블에 데이터가 있는지 확인
SELECT * FROM message_reads
ORDER BY updated_at DESC
LIMIT 10;

-- 2. unread_message_counts 뷰가 제대로 작동하는지 확인
SELECT
  room_name,
  user_id,
  unread_count,
  latest_message_time
FROM unread_message_counts
WHERE unread_count > 0
LIMIT 10;

-- 3. 특정 사용자의 읽지 않은 메시지 수 확인
SELECT
  room_name,
  unread_count
FROM unread_message_counts
WHERE user_id = 'YOUR_USER_ID';
```

---

## 🐛 트러블슈팅

### 문제: 여전히 카운트가 쌓임

**해결 1: 캐시 초기화**
```bash
# 브라우저 캐시 삭제
# Chrome: Ctrl+Shift+Delete → "Cached images and files" 체크 → Clear data

# 또는 Hard Refresh
# Chrome: Ctrl+Shift+R
# Firefox: Ctrl+F5
```

**해결 2: 서버 재시작**
```bash
# 개발 서버 재시작
npm run dev
```

**해결 3: TanStack Query 캐시 확인**
```typescript
// src/hooks/use-notifications.ts에서
// queryClient.invalidateQueries를 강제로 호출하는지 확인
```

### 문제: 마이그레이션 실행 오류

**오류 1: "message_reads 테이블이 없습니다"**
```sql
-- message_reads 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

-- RLS 정책 추가
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reads_select"
  ON message_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "message_reads_insert"
  ON message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reads_update"
  ON message_reads FOR UPDATE
  USING (user_id = auth.uid());
```

**오류 2: "권한이 없습니다"**
```sql
-- 관리자 권한으로 실행
-- Supabase Dashboard의 SQL Editor에서 실행하면 자동으로 관리자 권한 사용
```

---

## 📊 성능 개선 효과

### Before (버그 상태)
- ❌ 채팅방 안에서도 카운트 증가
- ❌ 불필요한 알림 표시
- ❌ 사용자 경험 저하

### After (수정 후)
- ✅ 채팅방 안: 카운트 0 유지
- ✅ 채팅방 밖: 정확한 카운트 표시
- ✅ 실시간 읽음 처리 반영
- ✅ 인덱스 최적화로 쿼리 속도 향상

---

## 📝 관련 파일

### 마이그레이션
- `supabase/migrations/20251016000000_fix_unread_counts_with_message_reads.sql`

### API
- `src/app/api/chat/read/route.ts` - 읽음 처리 API
- `src/app/api/chat/unread/route.ts` - 카운트 조회 API

### Frontend
- `src/hooks/use-notifications.ts` - 알림 상태 관리
- `src/components/chat/chat-layout.tsx` - 채팅 UI

---

## 🎯 다음 단계

1. ✅ 마이그레이션 적용
2. ✅ 브라우저에서 테스트
3. ✅ Playwright MCP로 자동화 테스트
4. ✅ 프로덕션 배포 전 QA

---

## 💡 추가 개선 사항 (선택사항)

### 1. Realtime 트리거로 자동 갱신

```sql
-- message_reads 테이블 변경 시 자동으로 알림
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
```

### 2. 읽음 처리 성능 최적화

```typescript
// src/hooks/use-notifications.ts
// Debounce를 더 짧게 (300ms → 150ms)
scheduleInvalidateUnread(150);
```

### 3. 로깅 추가 (디버깅용)

```typescript
// src/app/api/chat/read/route.ts
if (process.env.NODE_ENV === 'development') {
  console.log(`✅ markAsRead: user=${user.id}, room=${room_id}, message=${lastReadMessageId}`);
}
```

---

**문제가 해결되면 이 가이드를 닫아주세요! 🎉**
