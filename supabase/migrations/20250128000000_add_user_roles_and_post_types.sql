-- 사용자 역할과 게시글 타입 추가
-- 기존 스키마에 필요한 컬럼과 enum 추가

-- 사용자 역할 enum 생성
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- 게시글 타입 enum 생성  
CREATE TYPE public.post_type AS ENUM ('general', 'notice', 'anonymous');

-- profiles 테이블에 role 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'user';

-- posts 테이블에 post_type 컬럼 추가
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type public.post_type DEFAULT 'general';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_posts_type ON public.posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_author_type ON public.posts (author_id, post_type);

-- 기존 RLS 정책 업데이트
-- posts 조회 정책을 새로운 요구사항에 맞게 수정
DROP POLICY IF EXISTS posts_select ON public.posts;

CREATE POLICY "posts_visibility_policy" ON public.posts
FOR SELECT USING (
  CASE 
    -- 일반 게시글: 모든 사용자가 볼 수 있음
    WHEN post_type = 'general' THEN (status = 'published')
    
    -- 공지사항: 모든 사용자가 볼 수 있음 (관리자가 작성한 경우)
    WHEN post_type = 'notice' THEN (
      status = 'published' AND 
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = posts.author_id 
        AND profiles.role = 'admin'
      )
    )
    
    -- 익명 게시판: 본인만 볼 수 있음
    WHEN post_type = 'anonymous' THEN (
      status = 'published' AND auth.uid() = author_id
    )
    
    -- 초안: 작성자만 볼 수 있음
    WHEN status = 'draft' THEN (auth.uid() = author_id)
    
    ELSE false
  END
);

-- 기존 정책들 삭제 후 재생성
DROP POLICY IF EXISTS posts_insert ON public.posts;
DROP POLICY IF EXISTS posts_update_own ON public.posts;
DROP POLICY IF EXISTS posts_delete_own ON public.posts;

-- 게시글 작성 정책
CREATE POLICY "posts_insert_own" ON public.posts
FOR INSERT WITH CHECK (author_id = auth.uid());

-- 게시글 수정 정책  
CREATE POLICY "posts_update_own" ON public.posts
FOR UPDATE USING (author_id = auth.uid());

-- 게시글 삭제 정책
CREATE POLICY "posts_delete_own" ON public.posts
FOR DELETE USING (author_id = auth.uid());

-- 관리자 계정 생성 함수 (필요시 사용)
CREATE OR REPLACE FUNCTION public.make_admin(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE id = user_id;
END;
$$;

-- 기본 관리자 계정 설정 (실제 사용자 ID로 변경 필요)
-- INSERT INTO public.profiles (id, username, role) 
-- VALUES ('your-admin-user-id', 'admin', 'admin') 
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';