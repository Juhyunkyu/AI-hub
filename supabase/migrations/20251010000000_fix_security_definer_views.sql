-- Migration: Fix SECURITY DEFINER views to use SECURITY INVOKER
-- Date: 2025-10-10
-- Issue: Views bypass RLS by default (Supabase Advisor Warning)
-- Solution: Enable security_invoker to respect RLS policies

-- ============================================================
-- 1. profiles_security_stats
-- ============================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS public.profiles_security_stats;

-- Recreate with security_invoker enabled
CREATE VIEW public.profiles_security_stats
WITH (security_invoker = true)
AS
SELECT
  id,
  username,
  role,
  created_at,
  (SELECT COUNT(*) FROM posts WHERE author_id = profiles.id) AS post_count,
  (SELECT COUNT(*) FROM comments WHERE author_id = profiles.id) AS comment_count,
  (SELECT COUNT(*) FROM follows WHERE following_id = profiles.id) AS follower_count,
  (SELECT COUNT(*) FROM follows WHERE follower_id = profiles.id) AS following_count
FROM profiles;

-- Grant permissions
GRANT SELECT ON public.profiles_security_stats TO authenticated;

-- ============================================================
-- 2. profiles_audit_stats
-- ============================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS public.profiles_audit_stats;

-- Recreate with security_invoker enabled
CREATE VIEW public.profiles_audit_stats
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.username,
  p.role,
  p.created_at,
  COUNT(DISTINCT po.id) AS total_posts,
  COUNT(DISTINCT c.id) AS total_comments,
  COUNT(DISTINCT r.id) AS total_reactions
FROM profiles p
LEFT JOIN posts po ON po.author_id = p.id
LEFT JOIN comments c ON c.author_id = p.id
LEFT JOIN reactions r ON r.user_id = p.id
GROUP BY p.id, p.username, p.role, p.created_at;

-- Grant permissions
GRANT SELECT ON public.profiles_audit_stats TO authenticated;

-- ============================================================
-- 3. unread_message_counts
-- ============================================================

-- Drop existing view if exists
DROP VIEW IF EXISTS public.unread_message_counts;

-- Recreate with security_invoker enabled
CREATE VIEW public.unread_message_counts
WITH (security_invoker = true)
AS
SELECT
  crp.room_id,
  crp.user_id,
  COUNT(cm.id) AS unread_count
FROM chat_room_participants crp
LEFT JOIN chat_messages cm ON cm.room_id = crp.room_id
  AND cm.created_at > COALESCE(crp.last_read_at, '1970-01-01'::timestamptz)
  AND cm.sender_id != crp.user_id
GROUP BY crp.room_id, crp.user_id;

-- Grant permissions
GRANT SELECT ON public.unread_message_counts TO authenticated;

-- ============================================================
-- Comments
-- ============================================================

-- ✅ security_invoker = true: Views will respect RLS policies
-- ✅ GRANT SELECT: Only authenticated users can access
-- ✅ No more privilege escalation risks

-- To verify the fix, run:
-- SELECT table_name, security_invoker
-- FROM information_schema.views
-- WHERE table_schema = 'public'
--   AND table_name IN ('profiles_security_stats', 'profiles_audit_stats', 'unread_message_counts');
