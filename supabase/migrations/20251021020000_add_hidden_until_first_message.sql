-- ✅ 카카오톡 스타일: 첫 메시지 전송 시 상대방 리스트에 표시
--
-- 문제: 초대만 하면 즉시 상대방 리스트에 나타남
-- 해결: hidden_until_first_message 플래그 추가
--      - 초대받은 사람: true (리스트에 숨김)
--      - 초대한 사람: false (리스트에 표시)
--      - 첫 메시지 전송 시: 모든 참여자 false로 변경

-- 1. chat_room_participants 테이블에 필드 추가
ALTER TABLE chat_room_participants
ADD COLUMN IF NOT EXISTS hidden_until_first_message BOOLEAN DEFAULT true;

-- 2. 기존 레코드는 모두 false로 설정 (이미 메시지가 있을 수 있으므로)
UPDATE chat_room_participants
SET hidden_until_first_message = false
WHERE hidden_until_first_message IS NULL;

-- 3. 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_chat_room_participants_visible
ON chat_room_participants(user_id, room_id)
WHERE hidden_until_first_message = false;

-- 4. 첫 메시지 전송 시 자동으로 모든 참여자의 hidden 플래그 해제
CREATE OR REPLACE FUNCTION unhide_room_on_first_message()
RETURNS TRIGGER AS $$
BEGIN
  -- 시스템 메시지가 아닌 실제 메시지인 경우에만
  IF NEW.message_type != 'system' THEN
    UPDATE chat_room_participants
    SET hidden_until_first_message = false
    WHERE room_id = NEW.room_id
      AND hidden_until_first_message = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 트리거 생성
DROP TRIGGER IF EXISTS trigger_unhide_room_on_first_message ON chat_messages;
CREATE TRIGGER trigger_unhide_room_on_first_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION unhide_room_on_first_message();

-- 6. 설명 코멘트
COMMENT ON COLUMN chat_room_participants.hidden_until_first_message IS
'카카오톡 스타일: 초대받은 사람은 첫 메시지 전송 전까지 리스트에 숨김';
