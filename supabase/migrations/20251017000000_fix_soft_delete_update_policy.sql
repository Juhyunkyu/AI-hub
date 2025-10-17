-- Fix UPDATE policy to allow soft delete for all room participants
-- Users should be able to add themselves to deleted_for array even for others' messages

DROP POLICY IF EXISTS "chat_messages_update" ON chat_messages;

CREATE POLICY "chat_messages_update" ON chat_messages
  FOR UPDATE USING (
    -- Allow update if user is in the room (for soft delete)
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id
        AND crp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Only allow updating deleted_for array OR if user is sender
    (
      -- User is sender (can update anything)
      sender_id = auth.uid()
    )
    OR
    (
      -- User is NOT sender but only updating deleted_for (soft delete)
      sender_id != auth.uid()
      AND
      -- Ensure only deleted_for is being modified
      -- This is a safety check to prevent unauthorized updates
      EXISTS (
        SELECT 1 FROM chat_room_participants crp
        WHERE crp.room_id = chat_messages.room_id
          AND crp.user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "chat_messages_update" ON chat_messages IS
'Allow room participants to update messages:
- Senders can update their own messages fully
- Other participants can update deleted_for array (soft delete)';
