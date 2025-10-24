-- 배치 채팅방 생성 함수 (그룹 채팅, self 채팅 등)
--
-- 요구사항:
-- - 그룹 채팅방, self 채팅방 등 direct가 아닌 모든 타입 처리
-- - 원자적 트랜잭션 보장
-- - 참여자 일괄 추가
--
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
  -- creator는 is_admin = true, 나머지는 false
  FOREACH v_participant_id IN ARRAY v_participant_ids
  LOOP
    INSERT INTO chat_room_participants (room_id, user_id, is_admin)
    VALUES (
      v_room_id,
      v_participant_id,
      CASE WHEN v_participant_id = v_creator_id THEN true ELSE false END
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

-- 함수 권한 설정
REVOKE ALL ON FUNCTION create_chat_room_batch FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_chat_room_batch TO authenticated;

-- 함수 설명
COMMENT ON FUNCTION create_chat_room_batch IS
'Creates a group/self chat room with multiple participants in a single transaction.
Creator is automatically set as admin.';
