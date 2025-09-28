-- 실시간 채팅을 원래 작동하던 상태로 복구하는 마이그레이션
-- 문제가 되는 복잡한 정책들을 모두 제거하고 간단한 정책으로 교체

-- 1. 모든 문제가 되는 트리거와 함수들 제거
DROP TRIGGER IF EXISTS broadcast_chat_message_changes ON chat_messages;
DROP FUNCTION IF EXISTS broadcast_chat_message_changes();

-- 2. chat_messages 테이블의 모든 RLS 정책 재정의 (간단하게)
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;

-- 간단한 정책들로 교체
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id
        AND crp.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "chat_messages_delete" ON chat_messages
  FOR DELETE USING (sender_id = auth.uid());

-- 3. chat_room_participants 정책도 단순화
DROP POLICY IF EXISTS "chat_room_participants_insert" ON chat_room_participants;
DROP POLICY IF EXISTS "chat_room_participants_update" ON chat_room_participants;
DROP POLICY IF EXISTS "chat_room_participants_delete" ON chat_room_participants;
DROP POLICY IF EXISTS "chat_room_participants_select" ON chat_room_participants;

CREATE POLICY "chat_room_participants_select" ON chat_room_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chat_room_participants_insert" ON chat_room_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_room_participants_update" ON chat_room_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "chat_room_participants_delete" ON chat_room_participants
  FOR DELETE USING (user_id = auth.uid());

-- 4. chat_message_reads 정책도 단순화
DROP POLICY IF EXISTS "chat_message_reads_insert" ON chat_message_reads;
DROP POLICY IF EXISTS "chat_message_reads_update" ON chat_message_reads;
DROP POLICY IF EXISTS "chat_message_reads_delete" ON chat_message_reads;
DROP POLICY IF EXISTS "chat_message_reads_select" ON chat_message_reads;

CREATE POLICY "chat_message_reads_select" ON chat_message_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chat_message_reads_insert" ON chat_message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_message_reads_update" ON chat_message_reads
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "chat_message_reads_delete" ON chat_message_reads
  FOR DELETE USING (user_id = auth.uid());

-- 5. Realtime publication 재설정
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 6. 불필요한 realtime.messages 관련 정책들 제거
DROP POLICY IF EXISTS "authenticated_users_can_broadcast_chat_messages" ON realtime.messages;