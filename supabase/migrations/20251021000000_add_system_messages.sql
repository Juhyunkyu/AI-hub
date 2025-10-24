-- message_type is TEXT type, no enum modification needed
-- Function: Create system message when user is invited
CREATE OR REPLACE FUNCTION create_invite_system_message()
RETURNS TRIGGER AS $$
DECLARE
  inviter_name TEXT;
  invited_name TEXT;
  inviter_id UUID;
BEGIN
  -- Get inviter ID (current session user)
  inviter_id := (SELECT auth.uid());

  -- Get inviter name
  SELECT username INTO inviter_name
  FROM profiles
  WHERE id = inviter_id;

  -- Get invited user name
  SELECT username INTO invited_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create system message (only if inviter exists and is different from invited user)
  IF inviter_name IS NOT NULL
     AND invited_name IS NOT NULL
     AND inviter_id IS NOT NULL
     AND inviter_id != NEW.user_id THEN
    INSERT INTO chat_messages (room_id, sender_id, content, message_type)
    VALUES (
      NEW.room_id,
      NEW.user_id,
      inviter_name || '님이 ' || invited_name || '님을 초대했습니다.',
      'system'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: After participant insert
DROP TRIGGER IF EXISTS participant_invite_message ON chat_room_participants;
CREATE TRIGGER participant_invite_message
  AFTER INSERT ON chat_room_participants
  FOR EACH ROW EXECUTE FUNCTION create_invite_system_message();

-- Function: Create system message when user leaves
CREATE OR REPLACE FUNCTION create_leave_system_message()
RETURNS TRIGGER AS $$
DECLARE
  leaver_name TEXT;
BEGIN
  -- Get leaving user name
  SELECT username INTO leaver_name
  FROM profiles
  WHERE id = OLD.user_id;

  -- Create system message
  IF leaver_name IS NOT NULL THEN
    INSERT INTO chat_messages (room_id, sender_id, content, message_type)
    VALUES (
      OLD.room_id,
      OLD.user_id,
      leaver_name || '님이 채팅방에서 나갔습니다.',
      'system'
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Before participant delete
DROP TRIGGER IF EXISTS participant_leave_message ON chat_room_participants;
CREATE TRIGGER participant_leave_message
  BEFORE DELETE ON chat_room_participants
  FOR EACH ROW EXECUTE FUNCTION create_leave_system_message();
