-- Initial schema for AI hub
-- Requires: pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- profiles maps to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  bio text,
  avatar_url text,
  links jsonb not null default '{}'::jsonb,
  follower_count integer default 0,
  following_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create type public.post_status as enum ('draft','published','archived');

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text,
  url text,
  source text,
  thumbnail text,
  status public.post_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_topics (
  post_id uuid not null references public.posts(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  primary key (post_id, topic_id)
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create type public.comment_status as enum ('active','hidden','deleted');

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  status public.comment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.reaction_target as enum ('post','comment');
create type public.reaction_type as enum ('like');

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  target_type public.reaction_target not null,
  target_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.reaction_type not null default 'like',
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, type)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_user_id uuid references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_target_one CHECK (
    (case when following_user_id is not null then 1 else 0 end +
     case when topic_id is not null then 1 else 0 end +
     case when tag_id is not null then 1 else 0 end) = 1
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- indexes
create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_author on public.posts (author_id);
create index if not exists idx_comments_post_created on public.comments (post_id, created_at);
create index if not exists idx_post_tags_tag on public.post_tags (tag_id);
create index if not exists idx_post_topics_topic on public.post_topics (topic_id);
create index if not exists idx_reactions_target on public.reactions (target_type, target_id);
create index if not exists idx_follows_follower on public.follows (follower_id);
create index if not exists idx_notifications_user_read on public.notifications (user_id, is_read);

-- triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_posts_updated
before update on public.posts
for each row execute procedure public.set_updated_at();

create trigger trg_comments_updated
before update on public.comments
for each row execute procedure public.set_updated_at();

create trigger trg_profiles_updated
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- 팔로우 수 업데이트를 위한 함수
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 팔로잉 수 증가
    UPDATE profiles 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    
    -- 팔로워 수 증가
    UPDATE profiles 
    SET follower_count = follower_count + 1 
    WHERE id = NEW.following_user_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- 팔로잉 수 감소
    UPDATE profiles 
    SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
    
    -- 팔로워 수 감소
    UPDATE profiles 
    SET follower_count = follower_count - 1 
    WHERE id = OLD.following_user_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER follows_count_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- RLS
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_topics enable row level security;
alter table public.post_tags enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- profiles policies
create policy if not exists profiles_read_all
  on public.profiles for select using (true);
create policy if not exists profiles_insert_self
  on public.profiles for insert with check (id = auth.uid());
create policy if not exists profiles_update_self
  on public.profiles for update using (id = auth.uid());

-- topics/tags: read all, write admin-only (handled via service role; no public policies for write)
create policy if not exists topics_read_all on public.topics for select using (true);
create policy if not exists tags_read_all on public.tags for select using (true);

-- posts
create policy if not exists posts_select
  on public.posts for select using (status = 'published' or author_id = auth.uid());
create policy if not exists posts_insert
  on public.posts for insert with check (author_id = auth.uid());
create policy if not exists posts_update_own
  on public.posts for update using (author_id = auth.uid());
create policy if not exists posts_delete_own
  on public.posts for delete using (author_id = auth.uid());

-- post_topics/post_tags: author of post can manage
create policy if not exists post_topics_select on public.post_topics for select using (true);
create policy if not exists post_tags_select on public.post_tags for select using (true);
create policy if not exists post_topics_modify
  on public.post_topics for all using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  ) with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );
create policy if not exists post_tags_modify
  on public.post_tags for all using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  ) with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- comments
create policy if not exists comments_select on public.comments for select using (true);
create policy if not exists comments_insert on public.comments for insert with check (author_id = auth.uid());
create policy if not exists comments_update_own on public.comments for update using (author_id = auth.uid());
create policy if not exists comments_delete_own on public.comments for delete using (author_id = auth.uid());

-- reactions
create policy if not exists reactions_select on public.reactions for select using (true);
create policy if not exists reactions_insert on public.reactions for insert with check (user_id = auth.uid());
create policy if not exists reactions_delete_own on public.reactions for delete using (user_id = auth.uid());

-- collections
create policy if not exists collections_select
  on public.collections for select using (is_public or owner_id = auth.uid());
create policy if not exists collections_insert
  on public.collections for insert with check (owner_id = auth.uid());
create policy if not exists collections_update_own
  on public.collections for update using (owner_id = auth.uid());
create policy if not exists collections_delete_own
  on public.collections for delete using (owner_id = auth.uid());

-- collection_items
create policy if not exists collection_items_select
  on public.collection_items for select using (
    exists (
      select 1 from public.collections c where c.id = collection_id and (c.is_public or c.owner_id = auth.uid())
    )
  );
create policy if not exists collection_items_modify
  on public.collection_items for all using (
    exists (
      select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

-- follows
create policy if not exists follows_select on public.follows for select using (true);
create policy if not exists follows_insert on public.follows for insert with check (follower_id = auth.uid());
create policy if not exists follows_delete_own on public.follows for delete using (follower_id = auth.uid());

-- notifications
create policy if not exists notifications_select on public.notifications for select using (user_id = auth.uid());
create policy if not exists notifications_update_own on public.notifications for update using (user_id = auth.uid());
create policy if not exists notifications_insert_self on public.notifications for insert with check (user_id = auth.uid());

-- reports
create policy if not exists reports_select_own on public.reports for select using (reporter_id = auth.uid());
create policy if not exists reports_insert on public.reports for insert with check (reporter_id = auth.uid());
-- updates handled by moderators/admins via service role
