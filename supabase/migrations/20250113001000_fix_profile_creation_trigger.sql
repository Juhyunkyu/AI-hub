-- 회원가입 시 자동으로 profiles 테이블에 레코드를 생성하는 트리거 추가
-- 사용자의 닉네임이 제대로 저장되도록 수정

-- 1. 회원가입 시 자동으로 profile을 생성하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.users에 새 사용자가 생성되면 profiles 테이블에도 레코드 생성
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    -- user metadata에서 username 가져오기 (회원가입 시 입력한 닉네임)
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email_confirmed_at::text, 'user_' || substr(NEW.id::text, 1, 8)),
    'user'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(NEW.raw_user_meta_data->>'username', profiles.username),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. auth.users 테이블에 트리거 설정 (회원가입 시 자동 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. 기존 사용자들의 누락된 profile 복구
INSERT INTO public.profiles (id, username, role)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'username',
    split_part(u.email, '@', 1),
    'user_' || substr(u.id::text, 1, 8)
  ) as username,
  'user' as role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  username = COALESCE(EXCLUDED.username, profiles.username),
  updated_at = now();

-- 4. username이 중복되는 경우를 방지하기 위한 함수 (필요시 숫자 추가)
CREATE OR REPLACE FUNCTION public.ensure_unique_username(base_username text, user_id uuid)
RETURNS text AS $$
DECLARE
  final_username text;
  counter integer := 1;
BEGIN
  final_username := base_username;

  -- 중복 체크 및 고유한 username 생성
  WHILE EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username = final_username AND id != user_id
  ) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_username;
END;
$$ LANGUAGE plpgsql;

-- 5. 기존 사용자들의 중복된 username 처리
UPDATE public.profiles
SET username = public.ensure_unique_username(username, id)
WHERE username IN (
  SELECT username
  FROM public.profiles
  GROUP BY username
  HAVING COUNT(*) > 1
);

-- 6. username이 null이거나 빈 문자열인 경우 처리
UPDATE public.profiles
SET username = public.ensure_unique_username(
  COALESCE(
    NULLIF(username, ''),
    'user_' || substr(id::text, 1, 8)
  ),
  id
)
WHERE username IS NULL OR username = '';

-- 7. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;

COMMENT ON FUNCTION public.handle_new_user() IS '회원가입 시 자동으로 profiles 테이블에 사용자 레코드를 생성하는 함수';
COMMENT ON FUNCTION public.ensure_unique_username(text, uuid) IS '중복되지 않는 고유한 username을 생성하는 함수';