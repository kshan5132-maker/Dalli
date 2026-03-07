-- ============================================
-- Dalli (달리) Database Schema v2 - 개발용 (RLS 비활성화)
-- ============================================
-- 실행 방법:
-- 1. Supabase 대시보드 (https://supabase.com/dashboard) 접속
-- 2. 프로젝트 선택 -> SQL Editor 메뉴 클릭
-- 3. "New query" 클릭
-- 4. 이 파일의 전체 내용을 복사하여 붙여넣기
-- 5. "Run" 버튼 클릭
-- 6. 모든 테이블과 정책이 생성되었는지 Table Editor에서 확인
--
-- 주의: 이 스키마는 개발 단계용입니다.
-- RLS가 비활성화되어 있으므로 프로덕션 배포 전에
-- schema.sql의 RLS 정책을 다시 적용해야 합니다.
--
-- 기존 schema.sql을 이미 실행한 경우:
-- 이 파일을 실행하면 기존 RLS 정책이 제거되고 RLS가 비활성화됩니다.
-- 테이블 구조는 IF NOT EXISTS로 안전하게 처리됩니다.
-- ============================================

-- UUID 생성 확장 활성화
create extension if not exists "uuid-ossp";

-- ============================================
-- 기존 RLS 정책 제거 (이미 있는 경우)
-- ============================================
do $$
declare
  pol record;
begin
  -- profiles 정책 제거
  for pol in select policyname from pg_policies where tablename = 'profiles' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;

  -- routines 정책 제거
  for pol in select policyname from pg_policies where tablename = 'routines' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.routines', pol.policyname);
  end loop;

  -- groups 정책 제거
  for pol in select policyname from pg_policies where tablename = 'groups' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.groups', pol.policyname);
  end loop;

  -- group_members 정책 제거
  for pol in select policyname from pg_policies where tablename = 'group_members' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.group_members', pol.policyname);
  end loop;

  -- group_routines 정책 제거
  for pol in select policyname from pg_policies where tablename = 'group_routines' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.group_routines', pol.policyname);
  end loop;

  -- verifications 정책 제거
  for pol in select policyname from pg_policies where tablename = 'verifications' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.verifications', pol.policyname);
  end loop;
end $$;

-- ============================================
-- 테이블 생성 (IF NOT EXISTS로 안전하게)
-- ============================================

-- 1. profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- 2. routines
create table if not exists routines (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  frequency text not null check (frequency in ('daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends')),
  verification_type text not null default 'photo' check (verification_type in ('photo', 'check')),
  created_at timestamptz default now() not null
);

-- 3. groups
create table if not exists groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  invite_code text unique not null,
  penalty_amount int default 10000,
  created_by uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- 4. group_members
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

-- 5. group_routines
create table if not exists group_routines (
  group_id uuid references groups(id) on delete cascade,
  routine_id uuid references routines(id) on delete cascade,
  primary key (group_id, routine_id)
);

-- 6. verifications
create table if not exists verifications (
  id uuid default uuid_generate_v4() primary key,
  routine_id uuid references routines(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  group_id uuid references groups(id) on delete cascade,
  photo_url text,
  verified_at timestamptz default now() not null
);

-- ============================================
-- RLS 비활성화 (개발 단계)
-- ============================================
alter table profiles disable row level security;
alter table routines disable row level security;
alter table groups disable row level security;
alter table group_members disable row level security;
alter table group_routines disable row level security;
alter table verifications disable row level security;

-- ============================================
-- 트리거: 회원가입 시 프로필 자동 생성
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 트리거가 이미 존재하면 재생성
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Storage: 인증 사진 업로드용 버킷
-- ============================================
insert into storage.buckets (id, name, public)
values ('verifications', 'verifications', true)
on conflict (id) do nothing;

-- Storage RLS도 비활성화 (개발용)
-- Storage 정책 제거
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage'
    and policyname like '%verification%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 개발용 Storage 정책: 모든 인증된 사용자가 업로드/조회 가능
create policy "Dev: anyone can upload to verifications"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'verifications');

create policy "Dev: anyone can view verifications"
  on storage.objects for select
  using (bucket_id = 'verifications');

-- ============================================
-- 인덱스 (성능 최적화)
-- ============================================
create index if not exists idx_routines_user_id on routines(user_id);
create index if not exists idx_group_members_user_id on group_members(user_id);
create index if not exists idx_group_members_group_id on group_members(group_id);
create index if not exists idx_verifications_user_id on verifications(user_id);
create index if not exists idx_verifications_routine_id on verifications(routine_id);
create index if not exists idx_verifications_group_id on verifications(group_id);
create index if not exists idx_verifications_verified_at on verifications(verified_at);
create index if not exists idx_groups_invite_code on groups(invite_code);
