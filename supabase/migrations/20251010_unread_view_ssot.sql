-- UNREAD SSOT View: unify unread count schema and usage
-- This migration recreates the view with a fixed schema and security settings

-- Drop and recreate the view with security_invoker to respect RLS
DROP VIEW IF EXISTS public.unread_message_counts;

CREATE VIEW public.unread_message_counts
WITH (security_invoker = true)
AS
SELECT
  crp.room_id,
  crp.user_id,
  cr.name AS room_name,
  -- Use chat_rooms.updated_at as the canonical latest activity time
  -- kept fresh by trigger update_chat_room_updated_at()
  cr.updated_at AS latest_message_time,
  COUNT(cm.id) AS unread_count
FROM chat_room_participants crp
JOIN chat_rooms cr ON cr.id = crp.room_id
LEFT JOIN chat_messages cm
  ON cm.room_id = crp.room_id
  AND cm.created_at > COALESCE(crp.last_read_at, '1970-01-01'::timestamptz)
  AND cm.sender_id != crp.user_id
GROUP BY crp.room_id, crp.user_id, cr.name, cr.updated_at;

GRANT SELECT ON public.unread_message_counts TO authenticated;



