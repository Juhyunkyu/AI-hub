-- ✅ 채팅방 생성 함수에 hidden_until_first_message 로직 추가
--
-- 업데이트 내용:
-- 1. create_or_get_direct_chat_room: 생성자는 false, 초대받은 사람은 true
-- 2. create_chat_room_batch: 생성자는 false, 나머지는 true

-- 1:1 채팅방 생성 함수 업데이트
CREATE OR REPLACE FUNCTION create_or_get_direct_chat_room(
  p_current_user_id UUID,
  p_target_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_existing_room_id UUID;
  v_new_room_id UUID;
  v_result JSON;
BEGIN
  -- 입력 검증
  IF p_current_user_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'User IDs must not be null',
      'room_id', NULL,
      'is_new', false
    );
  END IF;

  -- 자기 자신과의 채팅 방지
  IF p_current_user_id = p_target_user_id THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'Cannot create chat room with yourself',
      'room_id', NULL,
      'is_new', false
    );
  END IF;

  -- 기존 1:1 채팅방 조회 (두 사용자가 모두 현재 참여자인 경우만)
  SELECT cr.id INTO v_existing_room_id
  FROM chat_rooms cr
  WHERE cr.type = 'direct'
    AND EXISTS (
      -- 현재 사용자가 참여 중인 방
      SELECT 1 FROM chat_room_participants crp1
      WHERE crp1.room_id = cr.id
        AND crp1.user_id = p_current_user_id
    )
    AND EXISTS (
      -- 대상 사용자도 참여 중인 방
      SELECT 1 FROM chat_room_participants crp2
      WHERE crp2.room_id = cr.id
        AND crp2.user_id = p_target_user_id
    )
    AND (
      -- 정확히 2명의 참여자만 있는 방 (다른 사용자가 없어야 함)
      SELECT COUNT(*) FROM chat_room_participants crp
      WHERE crp.room_id = cr.id
    ) = 2
  LIMIT 1;

  -- 기존 방이 있으면 반환
  IF v_existing_room_id IS NOT NULL THEN
    -- 기존 방을 다시 사용하는 경우, 양쪽 모두 hidden 해제
    UPDATE chat_room_participants
    SET hidden_until_first_message = false
    WHERE room_id = v_existing_room_id
      AND user_id IN (p_current_user_id, p_target_user_id);

    RETURN JSON_BUILD_OBJECT(
      'success', true,
      'error', NULL,
      'room_id', v_existing_room_id,
      'is_new', false
    );
  END IF;

  -- 새 채팅방 생성
  INSERT INTO chat_rooms (type, name)
  VALUES ('direct', NULL)
  RETURNING id INTO v_new_room_id;

  -- 두 사용자를 참여자로 추가
  -- 카카오톡 스타일: 생성자는 즉시 리스트에 표시, 초대받은 사람은 첫 메시지 전까지 숨김
  INSERT INTO chat_room_participants (room_id, user_id, is_admin, hidden_until_first_message)
  VALUES
    (v_new_room_id, p_current_user_id, false, false),  -- 생성자: 즉시 리스트에 표시
    (v_new_room_id, p_target_user_id, false, true);     -- 초대받은 사람: 첫 메시지 전까지 숨김

  -- 결과 반환
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'error', NULL,
    'room_id', v_new_room_id,
    'is_new', true
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', SQLERRM,
      'room_id', NULL,
      'is_new', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 배치 채팅방 생성 함수 업데이트
CREATE OR REPLACE FUNCTION create_chat_room_batch(
  p_room_data JSON
)
RETURNS JSON AS $$
DECLARE
  v_room_id UUID;
  v_room_type TEXT;
  v_room_name TEXT;
  v_creator_id UUID;
  v_participant_ids UUID[];
  v_participant_id UUID;
  v_result JSON;
BEGIN
  -- JSON에서 데이터 추출
  v_room_type := p_room_data->>'type';
  v_room_name := p_room_data->>'name';
  v_creator_id := (p_room_data->>'creator_id')::UUID;

  -- participant_ids 배열 추출
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(p_room_data->'participant_ids')::UUID
  ) INTO v_participant_ids;

  -- 입력 검증
  IF v_room_type IS NULL OR v_creator_id IS NULL THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'Room type and creator ID are required',
      'room_id', NULL
    );
  END IF;

  IF v_participant_ids IS NULL OR array_length(v_participant_ids, 1) IS NULL THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'At least one participant is required',
      'room_id', NULL
    );
  END IF;

  -- 채팅방 생성
  INSERT INTO chat_rooms (type, name)
  VALUES (v_room_type, v_room_name)
  RETURNING id INTO v_room_id;

  -- 참여자 일괄 추가
  -- 카카오톡 스타일: creator는 is_admin = true + hidden = false, 나머지는 hidden = true
  FOREACH v_participant_id IN ARRAY v_participant_ids
  LOOP
    INSERT INTO chat_room_participants (room_id, user_id, is_admin, hidden_until_first_message)
    VALUES (
      v_room_id,
      v_participant_id,
      CASE WHEN v_participant_id = v_creator_id THEN true ELSE false END,
      CASE WHEN v_participant_id = v_creator_id THEN false ELSE true END  -- 생성자만 즉시 표시
    );
  END LOOP;

  -- 성공 결과 반환
  RETURN JSON_BUILD_OBJECT(
    'success', true,
    'error', NULL,
    'room_id', v_room_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', SQLERRM,
      'room_id', NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 설명 업데이트
COMMENT ON FUNCTION create_or_get_direct_chat_room IS
'Creates a new 1:1 chat room or returns existing one if both users are currently participants.
If either user has left the room, a new room is created instead.
KakaoTalk-style: Creator sees room immediately, invitee sees room after first message.';

COMMENT ON FUNCTION create_chat_room_batch IS
'Creates a group/self chat room with multiple participants in a single transaction.
Creator is automatically set as admin.
KakaoTalk-style: Creator sees room immediately, invitees see room after first message.';
