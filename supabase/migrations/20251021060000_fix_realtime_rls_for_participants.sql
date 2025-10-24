-- Fix: Allow users to see other participants in the same room for Realtime events
-- This is required for Supabase Realtime to broadcast UPDATE events across participants

DROP POLICY IF EXISTS "chat_room_participants_select" ON chat_room_participants;

CREATE POLICY "chat_room_participants_select" ON chat_room_participants
  FOR SELECT USING (
    -- 사용자 자신의 참여 정보
    user_id = auth.uid()
    OR
    -- 같은 채팅방에 참여 중인 다른 사용자의 정보
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_room_participants.room_id
        AND crp.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "chat_room_participants_select" ON chat_room_participants IS
'사용자는 자신의 참여 정보와 같은 방에 있는 다른 참여자의 정보를 볼 수 있음. Realtime UPDATE 이벤트 브로드캐스트에 필요.';
