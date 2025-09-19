-- ============================================================================
-- TEAM HUB - COMPREHENSIVE RLS SECURITY ARCHITECTURE
-- ============================================================================
--
-- This file implements a defense-in-depth security model for the Team Hub project
-- addressing critical vulnerabilities identified in the security analysis:
--
-- CRITICAL FIXES:
-- - Redesigned make_admin function with proper SECURITY DEFINER controls
-- - Comprehensive storage policies with file validation
-- - Performance-optimized RLS policies with authenticated role specifications
--
-- ARCHITECTURE LAYERS:
-- 1. Role-Based Access Control (RBAC) Foundation
-- 2. Authentication & Authorization Framework
-- 3. Row-Level Security Policies
-- 4. Storage Security Controls
-- 5. Security Functions & Helpers
-- 6. Audit Trail System
-- 7. Real-time Security Controls
-- 8. Performance Optimization
--
-- Generated: 2025-01-19
-- Compatible with: Supabase PostgreSQL + Next.js 15.4.6
-- ============================================================================

-- ============================================================================
-- 1. ROLE-BASED ACCESS CONTROL (RBAC) FOUNDATION
-- ============================================================================

-- Define application roles
CREATE TYPE app_role AS ENUM (
  'anon',           -- Anonymous users (read-only public content)
  'authenticated',  -- Basic authenticated users
  'user',          -- Verified users with full access
  'moderator',     -- Content moderation capabilities
  'admin'          -- Full administrative access
);

-- Define granular permissions
CREATE TYPE app_permission AS ENUM (
  -- Content permissions
  'posts.create',
  'posts.edit.own',
  'posts.edit.any',
  'posts.delete.own',
  'posts.delete.any',
  'posts.moderate',

  -- User management permissions
  'users.view.profiles',
  'users.edit.own',
  'users.edit.any',
  'users.ban',
  'users.promote',

  -- System permissions
  'admin.panel.access',
  'admin.settings.modify',
  'admin.audit.view',
  'admin.security.manage',

  -- Moderation permissions
  'reports.view',
  'reports.resolve',
  'content.hide',
  'content.feature',

  -- Communication permissions
  'messages.send',
  'messages.moderate',
  'chat.create.room',
  'chat.moderate.room'
);

-- Role-Permission mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(role, permission)
);

-- User role assignments (extends profiles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, role)
);

-- Enable RLS on role tables
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. AUTHENTICATION & AUTHORIZATION FRAMEWORK
-- ============================================================================

-- Secure function to get user's current role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT NULL)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  user_role app_role;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(user_id, auth.uid());

  -- Return 'anon' for unauthenticated users
  IF target_user_id IS NULL THEN
    RETURN 'anon'::app_role;
  END IF;

  -- Get highest role for user (admin > moderator > user > authenticated)
  SELECT ur.role INTO user_role
  FROM user_roles ur
  WHERE ur.user_id = target_user_id
    AND ur.is_active = TRUE
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY
    CASE ur.role
      WHEN 'admin' THEN 5
      WHEN 'moderator' THEN 4
      WHEN 'user' THEN 3
      WHEN 'authenticated' THEN 2
      WHEN 'anon' THEN 1
    END DESC
  LIMIT 1;

  -- Default to 'authenticated' if user exists but has no explicit role
  RETURN COALESCE(user_role, 'authenticated'::app_role);
END;
$$;

-- Authorization function for permission checking
CREATE OR REPLACE FUNCTION authorize(
  requested_permission app_permission,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  user_role app_role;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- Get user's role
  user_role := get_user_role(user_id);

  -- Check if role has the requested permission
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role = user_role
      AND rp.permission = requested_permission
  ) INTO has_permission;

  -- Log authorization attempt for audit
  INSERT INTO audit_logs (
    event_type,
    user_id,
    details,
    ip_address
  ) VALUES (
    'authorization_check',
    COALESCE(user_id, auth.uid()),
    jsonb_build_object(
      'permission', requested_permission,
      'role', user_role,
      'granted', has_permission
    ),
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
  );

  RETURN has_permission;
END;
$$;

-- MFA enforcement function
CREATE OR REPLACE FUNCTION require_mfa()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if user has completed MFA (aal2)
  RETURN (SELECT auth.jwt()->>'aal') = 'aal2';
END;
$$;

-- Enhanced admin check with MFA requirement
CREATE OR REPLACE FUNCTION is_admin(require_mfa_check BOOLEAN DEFAULT TRUE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check admin role
  IF get_user_role() != 'admin'::app_role THEN
    RETURN FALSE;
  END IF;

  -- Optionally require MFA for admin operations
  IF require_mfa_check AND NOT require_mfa() THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant appropriate permissions to functions
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION authorize TO authenticated;
GRANT EXECUTE ON FUNCTION require_mfa TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- Revoke from public and anon for security
REVOKE EXECUTE ON FUNCTION get_user_role FROM public, anon;
REVOKE EXECUTE ON FUNCTION authorize FROM public, anon;
REVOKE EXECUTE ON FUNCTION require_mfa FROM public, anon;
REVOKE EXECUTE ON FUNCTION is_admin FROM public, anon;

-- ============================================================================
-- 3. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- PROFILES TABLE POLICIES
-- Enable RLS if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Public read access (optimized with proper role specification)
CREATE POLICY "profiles_select_public"
  ON profiles
  FOR SELECT
  TO authenticated, anon
  USING (TRUE);

-- Users can insert their own profile only
CREATE POLICY "profiles_insert_own"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Users can update their own profile + admin override
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR authorize('users.edit.any')
  );

-- Admin delete capability
CREATE POLICY "profiles_delete_admin"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (authorize('users.edit.any'));

-- POSTS TABLE POLICIES
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Public read for published posts
CREATE POLICY "posts_select_public"
  ON posts
  FOR SELECT
  TO authenticated, anon
  USING (
    status = 'published'
    OR (SELECT auth.uid()) = author_id
    OR authorize('posts.moderate')
  );

-- Authenticated users can create posts
CREATE POLICY "posts_insert_auth"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    authorize('posts.create')
    AND (SELECT auth.uid()) = author_id
  );

-- Authors can edit their own posts + admin/moderator override
CREATE POLICY "posts_update_author"
  ON posts
  FOR UPDATE
  TO authenticated
  USING (
    ((SELECT auth.uid()) = author_id AND authorize('posts.edit.own'))
    OR authorize('posts.edit.any')
  );

-- Authors can delete their own posts + admin override
CREATE POLICY "posts_delete_author"
  ON posts
  FOR DELETE
  TO authenticated
  USING (
    ((SELECT auth.uid()) = author_id AND authorize('posts.delete.own'))
    OR authorize('posts.delete.any')
  );

-- COMMENTS TABLE POLICIES
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Comments visible based on post visibility
CREATE POLICY "comments_select_based_on_post"
  ON comments
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id
        AND (
          p.status = 'published'
          OR (SELECT auth.uid()) = p.author_id
          OR authorize('posts.moderate')
        )
    )
  );

-- Authenticated users can create comments
CREATE POLICY "comments_insert_auth"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND p.status = 'published'
    )
  );

-- Authors can edit their own comments
CREATE POLICY "comments_update_author"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = author_id
    OR authorize('posts.moderate')
  );

-- Authors can delete their own comments + moderation
CREATE POLICY "comments_delete_author"
  ON comments
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = author_id
    OR authorize('posts.moderate')
  );

-- MESSAGES TABLE POLICIES (Private Communication)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages they sent or received
CREATE POLICY "messages_select_participants"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (from_user_id, to_user_id)
    OR authorize('messages.moderate')
  );

-- Users can send messages
CREATE POLICY "messages_insert_sender"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = from_user_id
    AND authorize('messages.send')
  );

-- Users can update their own messages (mark as read, etc.)
CREATE POLICY "messages_update_participants"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (from_user_id, to_user_id)
    OR authorize('messages.moderate')
  );

-- Only sender can delete messages
CREATE POLICY "messages_delete_sender"
  ON messages
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = from_user_id
    OR authorize('messages.moderate')
  );

-- FOLLOWS TABLE POLICIES
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Public read for follow relationships
CREATE POLICY "follows_select_public"
  ON follows
  FOR SELECT
  TO authenticated, anon
  USING (TRUE);

-- Users can manage their own follow relationships
CREATE POLICY "follows_insert_own"
  ON follows
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = follower_id);

CREATE POLICY "follows_delete_own"
  ON follows
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = follower_id);

-- REACTIONS TABLE POLICIES
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Public read for reactions
CREATE POLICY "reactions_select_public"
  ON reactions
  FOR SELECT
  TO authenticated, anon
  USING (TRUE);

-- Users can manage their own reactions
CREATE POLICY "reactions_insert_own"
  ON reactions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "reactions_update_own"
  ON reactions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "reactions_delete_own"
  ON reactions
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR authorize('posts.moderate')
  );

-- ROLE MANAGEMENT POLICIES
-- Role permissions table - admin read/write only
CREATE POLICY "role_permissions_admin_only"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (authorize('admin.security.manage'))
  WITH CHECK (authorize('admin.security.manage'));

-- User roles - users can view their own roles, admins can manage
CREATE POLICY "user_roles_view_own"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR authorize('users.view.profiles')
  );

CREATE POLICY "user_roles_admin_manage"
  ON user_roles
  FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (authorize('users.promote'))
  WITH CHECK (authorize('users.promote'));

-- ============================================================================
-- 4. STORAGE SECURITY CONTROLS
-- ============================================================================

-- Create storage buckets with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('post-media', 'post-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']),
  ('chat-files', 'chat-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- File validation function
CREATE OR REPLACE FUNCTION validate_file_upload(
  bucket_name TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bucket_config RECORD;
  user_storage_used BIGINT;
  user_storage_limit BIGINT := 104857600; -- 100MB per user
BEGIN
  -- Get bucket configuration
  SELECT * INTO bucket_config
  FROM storage.buckets
  WHERE id = bucket_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid bucket: %', bucket_name;
  END IF;

  -- Check file size against bucket limit
  IF file_size > bucket_config.file_size_limit THEN
    RAISE EXCEPTION 'File too large: % bytes (limit: %)', file_size, bucket_config.file_size_limit;
  END IF;

  -- Check MIME type
  IF NOT (mime_type = ANY(bucket_config.allowed_mime_types)) THEN
    RAISE EXCEPTION 'Invalid file type: % (allowed: %)', mime_type, bucket_config.allowed_mime_types;
  END IF;

  -- Check user storage quota
  SELECT COALESCE(SUM(metadata->>'size')::BIGINT, 0) INTO user_storage_used
  FROM storage.objects
  WHERE owner = auth.uid();

  IF user_storage_used + file_size > user_storage_limit THEN
    RAISE EXCEPTION 'Storage quota exceeded: % bytes used, % bytes limit', user_storage_used, user_storage_limit;
  END IF;

  -- Validate file name (no path traversal, reasonable length)
  IF file_name ~ '\.\./|[<>:"/\\|?*]' OR LENGTH(file_name) > 255 THEN
    RAISE EXCEPTION 'Invalid file name: %', file_name;
  END IF;

  RETURN TRUE;
END;
$$;

-- AVATARS BUCKET POLICIES
CREATE POLICY "avatars_select_public"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::TEXT = owner
    AND validate_file_upload('avatars', name, (metadata->>'size')::BIGINT, (metadata->>'mimetype')::TEXT)
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::TEXT = owner
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::TEXT = owner
  );

-- POST MEDIA POLICIES
CREATE POLICY "post_media_select_auth"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'post-media');

CREATE POLICY "post_media_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (SELECT auth.uid())::TEXT = owner
    AND validate_file_upload('post-media', name, (metadata->>'size')::BIGINT, (metadata->>'mimetype')::TEXT)
  );

CREATE POLICY "post_media_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (
      (SELECT auth.uid())::TEXT = owner
      OR authorize('posts.moderate')
    )
  );

-- CHAT FILES POLICIES
CREATE POLICY "chat_files_select_participants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (
      (SELECT auth.uid())::TEXT = owner
      OR authorize('messages.moderate')
    )
  );

CREATE POLICY "chat_files_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND (SELECT auth.uid())::TEXT = owner
    AND validate_file_upload('chat-files', name, (metadata->>'size')::BIGINT, (metadata->>'mimetype')::TEXT)
  );

-- ============================================================================
-- 5. SECURE ADMIN FUNCTIONS (FIXING CRITICAL make_admin VULNERABILITY)
-- ============================================================================

-- Secure admin promotion function (replaces vulnerable make_admin)
CREATE OR REPLACE FUNCTION promote_user_role(
  target_user_id UUID,
  new_role app_role,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_admin_id UUID;
  current_admin_role app_role;
  target_user_exists BOOLEAN;
BEGIN
  -- Get current authenticated user
  current_admin_id := auth.uid();

  -- Verify admin is authenticated
  IF current_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for role promotion';
  END IF;

  -- Require MFA for admin operations
  IF NOT require_mfa() THEN
    RAISE EXCEPTION 'Multi-factor authentication required for role promotion';
  END IF;

  -- Verify current user has admin privileges
  current_admin_role := get_user_role(current_admin_id);
  IF current_admin_role != 'admin'::app_role THEN
    RAISE EXCEPTION 'Insufficient privileges: admin role required';
  END IF;

  -- Verify target user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = target_user_id
  ) INTO target_user_exists;

  IF NOT target_user_exists THEN
    RAISE EXCEPTION 'Target user does not exist: %', target_user_id;
  END IF;

  -- Prevent self-promotion to admin (must be done by another admin)
  IF current_admin_id = target_user_id AND new_role = 'admin'::app_role THEN
    RAISE EXCEPTION 'Self-promotion to admin role is not allowed';
  END IF;

  -- Rate limiting: max 5 role changes per admin per hour
  IF (
    SELECT COUNT(*)
    FROM audit_logs
    WHERE user_id = current_admin_id
      AND event_type = 'role_promotion'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many role changes in the last hour';
  END IF;

  -- Insert or update user role
  INSERT INTO user_roles (user_id, role, assigned_by)
  VALUES (target_user_id, new_role, current_admin_id)
  ON CONFLICT (user_id, role) DO UPDATE SET
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = NOW(),
    is_active = TRUE;

  -- Deactivate other roles for the user (users have one primary role)
  UPDATE user_roles
  SET is_active = FALSE
  WHERE user_id = target_user_id AND role != new_role;

  -- Audit log the role change
  INSERT INTO audit_logs (
    event_type,
    user_id,
    target_user_id,
    details,
    ip_address
  ) VALUES (
    'role_promotion',
    current_admin_id,
    target_user_id,
    jsonb_build_object(
      'new_role', new_role,
      'reason', reason,
      'previous_role', get_user_role(target_user_id)
    ),
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
  );

  RETURN TRUE;
END;
$$;

-- Secure admin demotion function
CREATE OR REPLACE FUNCTION demote_user_role(
  target_user_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();

  -- Verify admin privileges and MFA
  IF NOT is_admin(TRUE) THEN
    RAISE EXCEPTION 'Admin privileges with MFA required';
  END IF;

  -- Prevent self-demotion
  IF current_admin_id = target_user_id THEN
    RAISE EXCEPTION 'Self-demotion is not allowed';
  END IF;

  -- Set user back to default 'user' role
  UPDATE user_roles
  SET role = 'user'::app_role,
      assigned_by = current_admin_id,
      assigned_at = NOW()
  WHERE user_id = target_user_id AND is_active = TRUE;

  -- Audit log
  INSERT INTO audit_logs (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'role_demotion',
    current_admin_id,
    target_user_id,
    jsonb_build_object('reason', reason)
  );

  RETURN TRUE;
END;
$$;

-- Secure user ban function
CREATE OR REPLACE FUNCTION ban_user(
  target_user_id UUID,
  reason TEXT,
  duration_hours INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- Verify admin/moderator privileges
  IF NOT (authorize('users.ban') AND require_mfa()) THEN
    RAISE EXCEPTION 'Insufficient privileges or MFA required for user banning';
  END IF;

  -- Calculate expiry time
  IF duration_hours IS NOT NULL THEN
    expires_at := NOW() + (duration_hours || ' hours')::INTERVAL;
  END IF;

  -- Create ban record
  INSERT INTO user_bans (
    user_id,
    banned_by,
    reason,
    expires_at
  ) VALUES (
    target_user_id,
    auth.uid(),
    reason,
    expires_at
  );

  -- Audit log
  INSERT INTO audit_logs (
    event_type,
    user_id,
    target_user_id,
    details
  ) VALUES (
    'user_ban',
    auth.uid(),
    target_user_id,
    jsonb_build_object(
      'reason', reason,
      'duration_hours', duration_hours,
      'expires_at', expires_at
    )
  );

  RETURN TRUE;
END;
$$;

-- Grant execute permissions only to authenticated users
GRANT EXECUTE ON FUNCTION promote_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION demote_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION ban_user TO authenticated;

-- Revoke from public and anon for security
REVOKE EXECUTE ON FUNCTION promote_user_role FROM public, anon;
REVOKE EXECUTE ON FUNCTION demote_user_role FROM public, anon;
REVOKE EXECUTE ON FUNCTION ban_user FROM public, anon;

-- ============================================================================
-- 6. AUDIT TRAIL SYSTEM
-- ============================================================================

-- Main audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  target_resource_type TEXT,
  target_resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User ban tracking
CREATE TABLE IF NOT EXISTS user_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  banned_by UUID REFERENCES auth.users(id) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'failed_login', 'suspicious_access', 'permission_denied'
  user_id UUID REFERENCES auth.users(id),
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  details JSONB DEFAULT '{}',
  ip_address INET,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Audit log policies (admin and system access only)
CREATE POLICY "audit_logs_admin_view"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (authorize('admin.audit.view'));

CREATE POLICY "audit_logs_system_insert"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE); -- System can always log

-- Security events policies
CREATE POLICY "security_events_admin_view"
  ON security_events
  FOR ALL
  TO authenticated
  USING (authorize('admin.security.manage'))
  WITH CHECK (authorize('admin.security.manage'));

-- User ban policies
CREATE POLICY "user_bans_admin_manage"
  ON user_bans
  FOR ALL
  TO authenticated
  USING (authorize('users.ban'))
  WITH CHECK (authorize('users.ban'));

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    event_type,
    user_id,
    target_resource_type,
    target_resource_id,
    details
  ) VALUES (
    TG_OP || '_' || TG_TABLE_NAME,
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_posts AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================================
-- 7. REAL-TIME SECURITY CONTROLS
-- ============================================================================

-- Real-time channel access control
CREATE OR REPLACE FUNCTION can_access_realtime_channel(
  channel_name TEXT,
  user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  channel_parts TEXT[];
BEGIN
  target_user_id := COALESCE(user_id, auth.uid());

  -- Parse channel name
  channel_parts := string_to_array(channel_name, ':');

  -- Public channels (posts, general feed)
  IF channel_parts[1] = 'public' THEN
    RETURN TRUE;
  END IF;

  -- User-specific channels
  IF channel_parts[1] = 'user' THEN
    RETURN target_user_id::TEXT = channel_parts[2];
  END IF;

  -- Chat room channels
  IF channel_parts[1] = 'chat' THEN
    RETURN EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.room_id = channel_parts[2]::UUID
        AND cp.user_id = target_user_id
        AND cp.is_active = TRUE
    );
  END IF;

  -- Admin channels
  IF channel_parts[1] = 'admin' THEN
    RETURN authorize('admin.panel.access');
  END IF;

  -- Default deny
  RETURN FALSE;
END;
$$;

-- Real-time message policies for broadcast/presence
CREATE POLICY "realtime_messages_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (can_access_realtime_channel(topic));

CREATE POLICY "realtime_messages_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (can_access_realtime_channel(topic));

-- ============================================================================
-- 8. PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_posts_author_status ON posts(author_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_author ON comments(post_id, author_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON messages(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON user_roles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON audit_logs(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_user_bans_user_active ON user_bans(user_id, is_active);

-- Materialized view for user permissions (performance optimization)
CREATE MATERIALIZED VIEW user_permissions AS
SELECT
  ur.user_id,
  ur.role,
  array_agg(rp.permission) as permissions
FROM user_roles ur
JOIN role_permissions rp ON ur.role = rp.role
WHERE ur.is_active = TRUE
GROUP BY ur.user_id, ur.role;

-- Index on materialized view
CREATE UNIQUE INDEX idx_user_permissions_user ON user_permissions(user_id);

-- Function to refresh user permissions
CREATE OR REPLACE FUNCTION refresh_user_permissions()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_permissions;
$$;

-- ============================================================================
-- 9. INITIAL ROLE PERMISSIONS SETUP
-- ============================================================================

-- Clear existing permissions
TRUNCATE role_permissions;

-- ANON role permissions (very limited)
INSERT INTO role_permissions (role, permission) VALUES
  ('anon', 'posts.create'), -- Can create posts if they register
  ('anon', 'users.view.profiles');

-- AUTHENTICATED role permissions (basic user)
INSERT INTO role_permissions (role, permission) VALUES
  ('authenticated', 'posts.create'),
  ('authenticated', 'posts.edit.own'),
  ('authenticated', 'posts.delete.own'),
  ('authenticated', 'users.view.profiles'),
  ('authenticated', 'users.edit.own'),
  ('authenticated', 'messages.send');

-- USER role permissions (verified user)
INSERT INTO role_permissions (role, permission) VALUES
  ('user', 'posts.create'),
  ('user', 'posts.edit.own'),
  ('user', 'posts.delete.own'),
  ('user', 'users.view.profiles'),
  ('user', 'users.edit.own'),
  ('user', 'messages.send'),
  ('user', 'chat.create.room');

-- MODERATOR role permissions
INSERT INTO role_permissions (role, permission) VALUES
  ('moderator', 'posts.create'),
  ('moderator', 'posts.edit.own'),
  ('moderator', 'posts.edit.any'),
  ('moderator', 'posts.delete.own'),
  ('moderator', 'posts.moderate'),
  ('moderator', 'users.view.profiles'),
  ('moderator', 'users.edit.own'),
  ('moderator', 'users.ban'),
  ('moderator', 'messages.send'),
  ('moderator', 'messages.moderate'),
  ('moderator', 'chat.create.room'),
  ('moderator', 'chat.moderate.room'),
  ('moderator', 'reports.view'),
  ('moderator', 'reports.resolve'),
  ('moderator', 'content.hide'),
  ('moderator', 'content.feature');

-- ADMIN role permissions (everything)
INSERT INTO role_permissions (role, permission)
SELECT 'admin', unnest(enum_range(NULL::app_permission));

-- ============================================================================
-- 10. SECURITY VALIDATION QUERIES
-- ============================================================================

-- Query to check RLS policy coverage
WITH table_policies AS (
  SELECT schemaname, tablename, policyname, cmd, roles
  FROM pg_policies
  WHERE schemaname = 'public'
),
tables_without_rls AS (
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN (
      SELECT tablename FROM table_policies
    )
)
SELECT 'Tables without RLS policies' as check_type,
       array_agg(tablename) as items
FROM tables_without_rls
WHERE array_length(array_agg(tablename), 1) > 0;

-- Query to check function security
SELECT 'Functions without proper security' as check_type,
       array_agg(proname) as items
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = FALSE
  AND p.proname LIKE '%admin%';

-- ============================================================================
-- END OF SECURITY ARCHITECTURE
-- ============================================================================

-- Final security reminder comments:
-- 1. Always test RLS policies in a staging environment
-- 2. Monitor audit logs for suspicious activity
-- 3. Regularly refresh user permissions materialized view
-- 4. Keep function permissions minimal (principle of least privilege)
-- 5. Enable MFA for all admin accounts
-- 6. Regularly review and update security policies
-- 7. Monitor performance impact of RLS policies
-- 8. Test edge cases and boundary conditions
-- 9. Implement rate limiting in application layer
-- 10. Regular security audits and penetration testing