-- 1:1 채팅방 생성 및 검색을 위한 최적화된 PostgreSQL 함수
-- 무한 재귀 문제 해결 및 원자성 보장

-- 1. 1:1 채팅방 생성/조회 함수
CREATE OR REPLACE FUNCTION create_or_get_direct_chat_room(
  p_current_user_id UUID,
  p_target_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  existing_room_id UUID;
  new_room_id UUID;
  result JSON;
  participant_count INT;
BEGIN
  -- 입력 검증
  IF p_current_user_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'User IDs cannot be null'
    );
  END IF;

  -- 동일한 사용자끼리는 채팅방 생성 불가
  IF p_current_user_id = p_target_user_id THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'Cannot create chat room with yourself'
    );
  END IF;

  -- 기존 1:1 채팅방 검색 (두 단계로 수행하여 무한 재귀 방지)
  -- 1단계: 현재 사용자가 참여한 direct 타입 채팅방들 조회
  WITH user_direct_rooms AS (
    SELECT DISTINCT crp.room_id
    FROM chat_room_participants crp
    JOIN chat_rooms cr ON crp.room_id = cr.id
    WHERE crp.user_id = p_current_user_id
      AND cr.type = 'direct'
  ),
  -- 2단계: 각 채팅방의 참여자 수와 대상 사용자 포함 여부 확인
  room_participants AS (
    SELECT
      udr.room_id,
      COUNT(*) as participant_count,
      BOOL_OR(crp.user_id = p_target_user_id) as has_target_user
    FROM user_direct_rooms udr
    JOIN chat_room_participants crp ON udr.room_id = crp.room_id
    GROUP BY udr.room_id
  )
  SELECT room_id INTO existing_room_id
  FROM room_participants
  WHERE participant_count = 2 AND has_target_user = true
  LIMIT 1;

  -- 기존 채팅방이 있으면 반환
  IF existing_room_id IS NOT NULL THEN
    SELECT JSON_BUILD_OBJECT(
      'success', true,
      'room_id', existing_room_id,
      'is_new', false
    ) INTO result;

    RETURN result;
  END IF;

  -- 새 채팅방 생성 (트랜잭션 내에서 원자성 보장)
  BEGIN
    -- 채팅방 생성
    INSERT INTO chat_rooms (type)
    VALUES ('direct')
    RETURNING id INTO new_room_id;

    -- 참여자 추가 (한 번에 처리)
    INSERT INTO chat_room_participants (room_id, user_id, is_admin)
    VALUES
      (new_room_id, p_current_user_id, true),
      (new_room_id, p_target_user_id, false);

    -- 성공 결과 반환
    result := JSON_BUILD_OBJECT(
      'success', true,
      'room_id', new_room_id,
      'is_new', true
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- 오류 발생 시 롤백 (PostgreSQL이 자동 처리)
      result := JSON_BUILD_OBJECT(
        'success', false,
        'error', 'Failed to create chat room: ' || SQLERRM
      );
  END;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 채팅방 존재 여부 빠른 확인 함수
CREATE OR REPLACE FUNCTION check_direct_chat_room_exists(
  p_user1_id UUID,
  p_user2_id UUID
)
RETURNS UUID AS $$
DECLARE
  room_id UUID;
BEGIN
  -- 두 사용자가 모두 참여한 direct 타입 채팅방 조회
  WITH shared_rooms AS (
    SELECT crp1.room_id
    FROM chat_room_participants crp1
    JOIN chat_room_participants crp2 ON crp1.room_id = crp2.room_id
    JOIN chat_rooms cr ON crp1.room_id = cr.id
    WHERE crp1.user_id = p_user1_id
      AND crp2.user_id = p_user2_id
      AND cr.type = 'direct'
  ),
  room_with_count AS (
    SELECT
      sr.room_id,
      COUNT(crp.user_id) as participant_count
    FROM shared_rooms sr
    JOIN chat_room_participants crp ON sr.room_id = crp.room_id
    GROUP BY sr.room_id
  )
  SELECT rwc.room_id INTO room_id
  FROM room_with_count rwc
  WHERE rwc.participant_count = 2
  LIMIT 1;

  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 대량 채팅방 생성을 위한 배치 함수
CREATE OR REPLACE FUNCTION create_chat_room_batch(
  p_room_data JSON
)
RETURNS JSON AS $$
DECLARE
  room_type TEXT;
  room_name TEXT;
  participant_ids UUID[];
  creator_id UUID;
  new_room_id UUID;
  result JSON;
BEGIN
  -- JSON 데이터 파싱
  room_type := p_room_data->>'type';
  room_name := p_room_data->>'name';
  creator_id := (p_room_data->>'creator_id')::UUID;

  -- 참여자 ID 배열 파싱
  SELECT ARRAY(
    SELECT (value::TEXT)::UUID
    FROM json_array_elements_text(p_room_data->'participant_ids')
  ) INTO participant_ids;

  -- 입력 검증
  IF room_type IS NULL OR creator_id IS NULL OR array_length(participant_ids, 1) IS NULL THEN
    RETURN JSON_BUILD_OBJECT(
      'success', false,
      'error', 'Invalid input parameters'
    );
  END IF;

  BEGIN
    -- 채팅방 생성
    INSERT INTO chat_rooms (name, type)
    VALUES (room_name, room_type)
    RETURNING id INTO new_room_id;

    -- 참여자 추가 (배열을 사용한 효율적인 삽입)
    INSERT INTO chat_room_participants (room_id, user_id, is_admin)
    SELECT
      new_room_id,
      unnest(participant_ids),
      unnest(participant_ids) = creator_id;

    -- 성공 결과
    result := JSON_BUILD_OBJECT(
      'success', true,
      'room_id', new_room_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      result := JSON_BUILD_OBJECT(
        'success', false,
        'error', 'Failed to create chat room: ' || SQLERRM
      );
  END;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 성능 최적화를 위한 추가 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_rooms_type
ON chat_rooms(type) WHERE type IN ('direct', 'group', 'self');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_participants_composite
ON chat_room_participants(room_id, user_id, is_admin);

-- 5. 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION create_or_get_direct_chat_room(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_direct_chat_room_exists(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_chat_room_batch(JSON) TO authenticated;

-- 6. 함수 성능 모니터링을 위한 통계 함수
CREATE OR REPLACE FUNCTION get_chat_room_function_stats()
RETURNS JSON AS $$
BEGIN
  RETURN JSON_BUILD_OBJECT(
    'total_direct_rooms', (
      SELECT COUNT(*) FROM chat_rooms WHERE type = 'direct'
    ),
    'avg_participants_per_room', (
      SELECT ROUND(AVG(participant_count), 2)
      FROM (
        SELECT COUNT(*) as participant_count
        FROM chat_room_participants
        GROUP BY room_id
      ) t
    ),
    'function_usage_today', (
      -- 이는 예시이며, 실제로는 별도의 로그 테이블이 필요
      SELECT 'Function statistics require audit logging setup'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_chat_room_function_stats() TO authenticated;