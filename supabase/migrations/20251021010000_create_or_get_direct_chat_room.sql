-- 1:1 채팅방 생성 또는 기존 방 조회 함수
--
-- 요구사항:
-- - 1:1 채팅방만 재사용
-- - 두 사용자가 모두 현재 참여자일 때만 재사용
-- - 한 명이라도 나간 경우 새로운 방 생성
--
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
  INSERT INTO chat_room_participants (room_id, user_id, is_admin)
  VALUES
    (v_new_room_id, p_current_user_id, false),
    (v_new_room_id, p_target_user_id, false);

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

-- 함수 권한 설정 (authenticated 사용자만 실행 가능)
REVOKE ALL ON FUNCTION create_or_get_direct_chat_room FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_or_get_direct_chat_room TO authenticated;

-- 테스트용 주석
COMMENT ON FUNCTION create_or_get_direct_chat_room IS
'Creates a new 1:1 chat room or returns existing one if both users are currently participants.
If either user has left the room, a new room is created instead.';
