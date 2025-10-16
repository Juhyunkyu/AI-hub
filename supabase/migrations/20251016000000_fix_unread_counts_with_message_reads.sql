-- ✅ FIX: unread_message_counts 뷰를 message_reads 테이블 기반으로 수정
--
-- 문제: 기존 뷰는 chat_room_participants.last_read_at을 사용했지만,
--      실제로는 message_reads 테이블에 읽음 정보를 저장하고 있었음
--
-- 결과: 읽음 처리를 해도 카운트가 감소하지 않는 버그 발생
--
-- 해결: message_reads 테이블의 last_read_at을 기준으로 카운트 계산

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
  -- 최신 메시지 시간 (채팅방 updated_at 사용)
  cr.updated_at AS latest_message_time,
  -- ✅ message_reads 테이블의 last_read_at 사용
  COUNT(cm.id) AS unread_count
FROM chat_room_participants crp
JOIN chat_rooms cr ON cr.id = crp.room_id
-- ✅ message_reads 테이블 LEFT JOIN (읽음 정보가 없을 수도 있음)
LEFT JOIN message_reads mr
  ON mr.room_id = crp.room_id
  AND mr.user_id = crp.user_id
-- 읽지 않은 메시지 조회
LEFT JOIN chat_messages cm
  ON cm.room_id = crp.room_id
  -- ✅ message_reads의 last_read_at 이후 메시지만 카운트
  AND cm.created_at > COALESCE(mr.last_read_at, '1970-01-01'::timestamptz)
  -- 자기 자신이 보낸 메시지는 제외
  AND cm.sender_id != crp.user_id
GROUP BY crp.room_id, crp.user_id, cr.name, cr.updated_at;

-- 권한 부여
GRANT SELECT ON public.unread_message_counts TO authenticated;

-- ✅ 성능 최적화를 위한 인덱스 (이미 있을 수 있지만 확인)
CREATE INDEX IF NOT EXISTS idx_message_reads_room_user
  ON message_reads(room_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_last_read_at
  ON message_reads(last_read_at);

-- ✅ 설명 코멘트
COMMENT ON VIEW public.unread_message_counts IS
'채팅방별 읽지 않은 메시지 수를 계산하는 뷰. message_reads 테이블의 last_read_at을 기준으로 계산함.';
