-- Add soft delete support to chat_messages table
-- This allows users to delete messages only for themselves (soft delete)
-- or completely for everyone if not yet read by others (hard delete)

-- 1. Add deleted_for column to track which users have deleted this message for themselves
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS deleted_for UUID[] DEFAULT ARRAY[]::UUID[];

-- 2. Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_for
  ON chat_messages USING GIN (deleted_for);

-- 3. Update RLS policy to filter out messages deleted for current user
DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_room_participants crp
      WHERE crp.room_id = chat_messages.room_id
        AND crp.user_id = auth.uid()
    )
    AND NOT (auth.uid() = ANY(deleted_for))
  );

-- 4. Add helpful comment
COMMENT ON COLUMN chat_messages.deleted_for IS
'Array of user IDs who have deleted this message for themselves (soft delete). If empty, message is visible to all participants.';
