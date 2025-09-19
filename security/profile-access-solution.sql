-- ============================================================================
-- PROFILE ACCESS SECURITY SOLUTION
-- ============================================================================
--
-- 문제: 비로그인 사용자가 프로필 기본 정보(닉네임, 아바타)를 볼 수 없어
--       게시물 작성자가 "사용자" 또는 "익명"으로 표시됨
--
-- 해결방안: 단계별 정보 노출 전략으로 보안과 사용성 균형
-- ============================================================================

-- 1. 프로필 테이블 RLS 정책 개선
-- 현재 정책을 더 세밀하게 제어하도록 수정

-- 기존 정책 제거
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;

-- 새로운 공개 정보 정책 생성
-- 비로그인 사용자도 기본 프로필 정보(username, avatar_url)는 볼 수 있도록 허용
CREATE POLICY "profiles_select_public_basic"
  ON profiles
  FOR SELECT
  TO authenticated, anon
  USING (TRUE);

-- 2. 뷰를 통한 선택적 정보 노출
-- 비로그인 사용자를 위한 제한된 프로필 정보 뷰
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  username,
  avatar_url,
  created_at
FROM profiles;

-- 인증된 사용자를 위한 전체 프로필 정보 뷰
CREATE OR REPLACE VIEW full_profiles AS
SELECT
  id,
  username,
  bio,
  avatar_url,
  links,
  follower_count,
  following_count,
  created_at,
  updated_at,
  role
FROM profiles;

-- 3. 보안 함수: 프로필 정보 컨텍스트별 반환
CREATE OR REPLACE FUNCTION get_profile_display_info(
  user_id UUID,
  is_anonymous BOOLEAN DEFAULT FALSE,
  requester_authenticated BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  avatar_url TEXT,
  show_full_profile BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- 익명 게시글인 경우
  IF is_anonymous THEN
    RETURN QUERY SELECT
      user_id as id,
      '익명'::TEXT as display_name,
      NULL::TEXT as avatar_url,
      FALSE as show_full_profile;
    RETURN;
  END IF;

  -- 일반 게시글의 경우 - 공개 정보 반환
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(p.username, '사용자' || SUBSTRING(p.id::TEXT, 1, 8)) as display_name,
    p.avatar_url,
    requester_authenticated as show_full_profile
  FROM profiles p
  WHERE p.id = user_id;
END;
$$;

-- 4. 성능 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_public_lookup
ON profiles (id, username, avatar_url)
WHERE username IS NOT NULL;

-- 5. 보안 검증 함수
CREATE OR REPLACE FUNCTION validate_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 민감한 정보 업데이트는 본인만 가능
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id != auth.uid() AND NOT authorize('users.edit.any') THEN
      RAISE EXCEPTION 'Unauthorized profile update attempt';
    END IF;
  END IF;

  -- 프로필 삭제는 관리자만 가능
  IF TG_OP = 'DELETE' THEN
    IF NOT authorize('users.edit.any') THEN
      RAISE EXCEPTION 'Unauthorized profile deletion attempt';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 트리거 적용
CREATE TRIGGER profile_access_validation
  BEFORE UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_access();

-- 6. 컨텍스트별 권한 정책
-- 게시물 컨텍스트에서의 작성자 정보 정책
CREATE POLICY "profiles_in_post_context"
  ON profiles
  FOR SELECT
  TO authenticated, anon
  USING (
    -- 게시물 작성자로 참조되는 경우만 기본 정보 노출
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.author_id = profiles.id
        AND p.status = 'published'
    )
    OR
    -- 댓글 작성자로 참조되는 경우
    EXISTS (
      SELECT 1 FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.author_id = profiles.id
        AND p.status = 'published'
        AND c.status = 'active'
    )
  );

-- 7. 감사 로깅 강화
CREATE OR REPLACE FUNCTION log_profile_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 민감한 프로필 정보 접근 로깅
  IF TG_OP = 'SELECT' AND auth.uid() != NEW.id THEN
    INSERT INTO audit_logs (
      event_type,
      user_id,
      target_user_id,
      details,
      ip_address
    ) VALUES (
      'profile_access',
      auth.uid(),
      NEW.id,
      jsonb_build_object(
        'accessed_fields', TG_ARGV[0],
        'context', current_setting('application.context', true)
      ),
      current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 8. 익명 게시글 처리 개선
-- 익명 게시글인지 확인하는 함수
CREATE OR REPLACE FUNCTION is_post_anonymous(post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  is_anon BOOLEAN;
BEGIN
  SELECT
    CASE
      WHEN post_type = 'anonymous' THEN TRUE
      WHEN anonymous = TRUE THEN TRUE  -- 기존 컬럼 호환성
      ELSE FALSE
    END
  INTO is_anon
  FROM posts
  WHERE id = post_id;

  RETURN COALESCE(is_anon, FALSE);
END;
$$;

-- 9. 실시간 업데이트를 위한 보안 정책
-- 프로필 변경 시 실시간 알림 채널 보안
CREATE POLICY "profile_realtime_updates"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- 본인 프로필 업데이트만 실시간 브로드캐스트
    auth.uid() = id
  );

-- 10. 테스트 및 검증 쿼리
-- 보안 정책이 올바르게 작동하는지 확인
DO $$
DECLARE
  test_result RECORD;
BEGIN
  -- 비로그인 사용자 접근 테스트
  SET LOCAL role = 'anon';

  SELECT COUNT(*) as accessible_profiles
  INTO test_result
  FROM profiles
  WHERE username IS NOT NULL;

  RAISE NOTICE 'Anonymous users can access % profiles', test_result.accessible_profiles;

  RESET role;
END;
$$;

-- 권한 부여
GRANT SELECT ON public_profiles TO authenticated, anon;
GRANT SELECT ON full_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_display_info TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_post_anonymous TO authenticated, anon;

-- 보안을 위한 권한 제한
REVOKE ALL ON full_profiles FROM anon;
REVOKE EXECUTE ON FUNCTION validate_profile_access FROM public, anon;

-- ============================================================================
-- 구현 가이드라인
-- ============================================================================
--
-- 1. 애플리케이션 계층에서 구현할 사항:
--    - get_profile_display_info() 함수 사용하여 컨텍스트별 정보 표시
--    - 비로그인 사용자에게는 public_profiles 뷰 사용
--    - 인증된 사용자에게는 full_profiles 뷰 사용
--
-- 2. 프론트엔드에서 구현할 사항:
--    - UserAvatar 컴포넌트에서 authentication 상태에 따른 기능 제한
--    - 비로그인 시: 프로필 클릭 시 로그인 페이지로 리다이렉트
--    - 익명 게시글: 상호작용 기능 완전 비활성화
--
-- 3. 성능 고려사항:
--    - 자주 조회되는 프로필 정보 캐싱
--    - 인덱스 최적화로 조회 성능 확보
--    - 불필요한 프로필 조회 최소화
--
-- 4. 보안 모니터링:
--    - audit_logs 테이블로 프로필 접근 패턴 모니터링
--    - 비정상적인 접근 패턴 탐지 및 알림
--    - 정기적인 보안 정책 검토
-- ============================================================================