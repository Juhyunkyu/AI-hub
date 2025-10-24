-- Fix: Add SECURITY DEFINER to unhide_room_on_first_message function
-- This allows the trigger to bypass RLS and update ALL participants' rows
-- when the first message is sent, ensuring Realtime UPDATE events fire correctly

CREATE OR REPLACE FUNCTION unhide_room_on_first_message()
RETURNS TRIGGER
SECURITY DEFINER  -- ✅ Bypass RLS to update all participants
SET search_path = public
AS $$
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

COMMENT ON FUNCTION unhide_room_on_first_message() IS
'카카오톡 스타일: 첫 메시지 전송 시 모든 참여자의 채팅방을 표시. SECURITY DEFINER로 RLS 우회하여 Realtime UPDATE 이벤트 정상 작동.';
