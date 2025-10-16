-- 공지글 및 상단고정 필드에 대한 관리자 권한 체크 RLS 정책 추가
-- 작성일: 2025-10-16
-- 목적: 일반 사용자가 is_notice, pin_scope 등 관리자 전용 필드를 설정하지 못하도록 함

-- 기존 정책 삭제
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;

-- 새로운 INSERT 정책: 관리자 전용 필드 체크
CREATE POLICY "posts_insert_with_role_check" ON public.posts
FOR INSERT WITH CHECK (
  -- 작성자 본인이어야 함
  author_id = auth.uid() AND
  (
    -- 일반 게시글 (공지 아님, 핀 아님): 누구나 작성 가능
    (
      is_notice = false AND
      pin_scope IS NULL AND
      pin_priority = 0 AND
      pinned_until IS NULL
    )
    OR
    -- 공지글 또는 상단고정: 관리자만 가능
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- 새로운 UPDATE 정책: 관리자 전용 필드 체크
CREATE POLICY "posts_update_with_role_check" ON public.posts
FOR UPDATE USING (
  -- 작성자 본인이어야 함
  author_id = auth.uid()
)
WITH CHECK (
  -- 작성자 본인이어야 함
  author_id = auth.uid() AND
  (
    -- 일반 게시글로 수정: 누구나 가능
    (
      is_notice = false AND
      pin_scope IS NULL AND
      pin_priority = 0 AND
      pinned_until IS NULL
    )
    OR
    -- 공지글 또는 상단고정으로 수정: 관리자만 가능
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- 정책 설명을 위한 주석
COMMENT ON POLICY "posts_insert_with_role_check" ON public.posts IS
'게시글 작성 시 is_notice, pin_scope 등 관리자 전용 필드는 관리자만 설정 가능';

COMMENT ON POLICY "posts_update_with_role_check" ON public.posts IS
'게시글 수정 시 is_notice, pin_scope 등 관리자 전용 필드는 관리자만 설정 가능';
