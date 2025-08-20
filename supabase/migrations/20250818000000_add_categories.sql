-- 카테고리 테이블 추가
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 기존 topics 테이블에 category_id 컬럼 추가
alter table public.topics add column if not exists category_id uuid references public.categories(id) on delete set null;

-- 카테고리 RLS 정책
alter table public.categories enable row level security;

create policy if not exists categories_read_all on public.categories for select using (true);

-- 기본 카테고리 데이터 삽입
insert into public.categories (slug, name, description, icon, color, sort_order) values
  ('free', '자유게시판', '커뮤니티의 시작', 'message-circle', 'blue', 1),
  ('ai-qa', 'AI 물어보기', '초보자를 위한 공간', 'help-circle', 'green', 2),
  ('ai-briefing', 'AI 브리핑', '핵심 정보 제공', 'file-text', 'purple', 3),
  ('vibe-coding', '바이브코딩', '기술/개발 분야', 'code', 'orange', 4),
  ('ai-studio', 'AI 스튜디오', '디자인/창작 분야', 'palette', 'pink', 5)
on conflict (slug) do nothing;

-- 인덱스 추가
create index if not exists idx_categories_sort_order on public.categories (sort_order);
create index if not exists idx_topics_category on public.topics (category_id);
