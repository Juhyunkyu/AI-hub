-- 채팅 성능 최적화를 위한 인덱스 및 함수 생성

-- 1. 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created 
ON chat_messages(room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_room 
ON chat_messages(sender_id, room_id);

CREATE INDEX IF NOT EXISTS idx_chat_room_participants_user_room 
ON chat_room_participants(user_id, room_id);

CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message_user 
ON chat_message_reads(message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

-- 2. 최적화된 채팅방 조회 함수
CREATE OR REPLACE FUNCTION get_chat_rooms_optimized(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH user_rooms AS (
    -- 사용자가 참여한 채팅방
    SELECT crp.room_id, crp.last_read_at
    FROM chat_room_participants crp
    WHERE crp.user_id = p_user_id
  ),
  room_data AS (
    -- 채팅방 기본 정보
    SELECT 
      cr.*,
      ur.last_read_at as user_last_read_at
    FROM chat_rooms cr
    JOIN user_rooms ur ON cr.id = ur.room_id
    ORDER BY cr.updated_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  last_messages AS (
    -- 각 채팅방의 마지막 메시지 (윈도우 함수 활용)
    SELECT DISTINCT ON (cm.room_id)
      cm.room_id,
      cm.id,
      cm.content,
      cm.created_at,
      cm.message_type,
      cm.sender_id,
      p.username as sender_username,
      p.avatar_url as sender_avatar_url
    FROM chat_messages cm
    JOIN profiles p ON cm.sender_id = p.id
    WHERE cm.room_id IN (SELECT room_id FROM user_rooms)
    ORDER BY cm.room_id, cm.created_at DESC
  ),
  unread_counts AS (
    -- 읽지 않은 메시지 수
    SELECT 
      cm.room_id,
      COUNT(*) as unread_count
    FROM chat_messages cm
    JOIN user_rooms ur ON cm.room_id = ur.room_id
    WHERE cm.sender_id != p_user_id
      AND (ur.last_read_at IS NULL OR cm.created_at > ur.last_read_at)
    GROUP BY cm.room_id
  ),
  participants_data AS (
    -- 참여자 정보
    SELECT 
      crp.room_id,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', crp.id,
          'user_id', crp.user_id,
          'joined_at', crp.joined_at,
          'last_read_at', crp.last_read_at,
          'is_admin', crp.is_admin,
          'user', JSON_BUILD_OBJECT(
            'id', p.id,
            'username', p.username,
            'avatar_url', p.avatar_url
          )
        )
      ) as participants
    FROM chat_room_participants crp
    JOIN profiles p ON crp.user_id = p.id
    WHERE crp.room_id IN (SELECT room_id FROM user_rooms)
    GROUP BY crp.room_id
  )
  SELECT JSON_AGG(
    JSON_BUILD_OBJECT(
      'id', rd.id,
      'name', rd.name,
      'type', rd.type,
      'created_at', rd.created_at,
      'updated_at', rd.updated_at,
      'last_message', CASE 
        WHEN lm.id IS NOT NULL THEN
          JSON_BUILD_OBJECT(
            'id', lm.id,
            'content', lm.content,
            'created_at', lm.created_at,
            'message_type', lm.message_type,
            'sender', JSON_BUILD_OBJECT(
              'id', lm.sender_id,
              'username', lm.sender_username,
              'avatar_url', lm.sender_avatar_url
            )
          )
        ELSE NULL
      END,
      'unread_count', COALESCE(uc.unread_count, 0),
      'participants', pd.participants
    )
    ORDER BY rd.updated_at DESC
  ) INTO result
  FROM room_data rd
  LEFT JOIN last_messages lm ON rd.id = lm.room_id
  LEFT JOIN unread_counts uc ON rd.id = uc.room_id
  LEFT JOIN participants_data pd ON rd.id = pd.room_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 메시지 조회 성능 최적화를 위한 뷰
CREATE OR REPLACE VIEW chat_messages_with_sender AS
SELECT 
  cm.id,
  cm.room_id,
  cm.sender_id,
  cm.content,
  cm.message_type,
  cm.file_url,
  cm.file_name,
  cm.file_size,
  cm.reply_to_id,
  cm.created_at,
  cm.updated_at,
  p.username as sender_username,
  p.avatar_url as sender_avatar_url
FROM chat_messages cm
JOIN profiles p ON cm.sender_id = p.id;

-- 4. 읽지 않은 메시지 수 계산 함수
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS INT AS $$
DECLARE
  unread_count INT;
  last_read_at TIMESTAMPTZ;
BEGIN
  -- 사용자의 마지막 읽음 시간 조회
  SELECT crp.last_read_at INTO last_read_at
  FROM chat_room_participants crp
  WHERE crp.room_id = p_room_id AND crp.user_id = p_user_id;

  -- 읽지 않은 메시지 수 계산
  IF last_read_at IS NULL THEN
    SELECT COUNT(*) INTO unread_count
    FROM chat_messages cm
    WHERE cm.room_id = p_room_id AND cm.sender_id != p_user_id;
  ELSE
    SELECT COUNT(*) INTO unread_count
    FROM chat_messages cm
    WHERE cm.room_id = p_room_id 
      AND cm.sender_id != p_user_id
      AND cm.created_at > last_read_at;
  END IF;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 채팅방 업데이트 트리거 (마지막 메시지 시간 자동 업데이트)
CREATE OR REPLACE FUNCTION update_chat_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms 
  SET updated_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_room_updated_at ON chat_messages;
CREATE TRIGGER trigger_update_room_updated_at
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_updated_at();

-- 6. RLS 정책 최적화
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id 
        AND crp.user_id = auth.uid()
    )
  );

-- 인덱스를 활용한 RLS 정책으로 개선
DROP POLICY IF EXISTS "chat_rooms_select" ON chat_rooms;
CREATE POLICY "chat_rooms_select" ON chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_rooms.id 
        AND crp.user_id = auth.uid()
    )
  );

-- 7. 성능 모니터링을 위한 통계 수집
CREATE OR REPLACE FUNCTION collect_chat_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT JSON_BUILD_OBJECT(
    'total_rooms', (SELECT COUNT(*) FROM chat_rooms),
    'total_messages', (SELECT COUNT(*) FROM chat_messages),
    'total_participants', (SELECT COUNT(*) FROM chat_room_participants),
    'avg_messages_per_room', (
      SELECT ROUND(AVG(message_count), 2)
      FROM (
        SELECT COUNT(*) as message_count
        FROM chat_messages
        GROUP BY room_id
      ) t
    ),
    'most_active_rooms', (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'room_id', room_id,
          'message_count', message_count
        )
      )
      FROM (
        SELECT room_id, COUNT(*) as message_count
        FROM chat_messages
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY room_id
        ORDER BY message_count DESC
        LIMIT 5
      ) t
    )
  ) INTO stats;

  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;