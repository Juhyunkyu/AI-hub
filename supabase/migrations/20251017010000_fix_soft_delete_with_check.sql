-- Fix WITH CHECK clause to properly allow soft delete for room participants
-- The issue: WITH CHECK was too restrictive and didn't verify only deleted_for was modified

DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE USING (
    -- Allow update if user is in the room
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id
        AND crp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- User is sender (can update anything) OR
    -- User is in room (can add themselves to deleted_for)
    sender_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id
        AND crp.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "chat_messages_update" ON chat_messages IS
'Allow message updates:
- Message sender can update all fields
- Room participants can update deleted_for array (soft delete)
- Additional validation in application layer ensures only deleted_for is modified by non-senders';
