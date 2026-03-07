-- ============================================
-- Dalli (달리) Database Schema
-- ============================================
-- 실행 방법:
-- 1. Supabase 대시보드 (https://supabase.com/dashboard) 접속
-- 2. 프로젝트 선택 → SQL Editor 메뉴 클릭
-- 3. "New query" 클릭
-- 4. 이 파일의 전체 내용을 복사하여 붙여넣기
-- 5. "Run" 버튼 클릭
-- 6. 모든 테이블과 정책이 생성되었는지 Table Editor에서 확인
-- ============================================

-- UUID 생성 확장 활성화
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. profiles (사용자 프로필)
-- auth.users와 1:1 연결. 회원가입 시 자동 생성됨.
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- ============================================
-- 2. routines (루틴)
-- 사용자가 만든 루틴 (운동, 다이어트, 금주 등)
-- frequency: 'daily'(매일), 'weekly_3'(주3회), 'weekly_5'(주5회), 'weekdays'(평일), 'weekends'(주말)
-- verification_type: 'photo'(사진인증), 'check'(체크인증)
-- ============================================
create table routines (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  frequency text not null check (frequency in ('daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends')),
  verification_type text not null default 'photo' check (verification_type in ('photo', 'check')),
  created_at timestamptz default now() not null
);

-- ============================================
-- 3. groups (그룹)
-- 친구들과 함께하는 루틴 인증 그룹
-- invite_code: 6자리 영문숫자 초대코드 (유니크)
-- penalty_amount: 미달성 시 벌금 (기본 10,000원)
-- ============================================
create table groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  invite_code text unique not null,
  penalty_amount int default 10000,
  created_by uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- ============================================
-- 4. group_members (그룹 멤버)
-- 어떤 사용자가 어떤 그룹에 속해있는지
-- ============================================
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

-- ============================================
-- 5. group_routines (그룹-루틴 연결)
-- 그룹에서 인증할 루틴 목록
-- ============================================
create table group_routines (
  group_id uuid references groups(id) on delete cascade,
  routine_id uuid references routines(id) on delete cascade,
  primary key (group_id, routine_id)
);

-- ============================================
-- 6. verifications (인증 기록)
-- 사용자가 루틴을 수행했다는 증거 (사진 또는 체크)
-- ============================================
create table verifications (
  id uuid default uuid_generate_v4() primary key,
  routine_id uuid references routines(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  group_id uuid references groups(id) on delete cascade,
  photo_url text,
  verified_at timestamptz default now() not null
);

-- ============================================
-- Row Level Security (RLS) 활성화
-- ============================================
alter table profiles enable row level security;
alter table routines enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_routines enable row level security;
alter table verifications enable row level security;

-- ============================================
-- RLS 정책: profiles
-- ============================================
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can view profiles of group members"
  on profiles for select
  using (
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- ============================================
-- RLS 정책: routines
-- ============================================
create policy "Users can view own routines"
  on routines for select
  using (auth.uid() = user_id);

create policy "Users can create own routines"
  on routines for insert
  with check (auth.uid() = user_id);

create policy "Users can update own routines"
  on routines for update
  using (auth.uid() = user_id);

create policy "Users can delete own routines"
  on routines for delete
  using (auth.uid() = user_id);

-- ============================================
-- RLS 정책: groups
-- ============================================
-- 인증된 사용자는 그룹 정보를 조회 가능 (초대 코드로 가입하기 위해 필요)
create policy "Authenticated users can view groups"
  on groups for select
  to authenticated
  using (true);

create policy "Users can create groups"
  on groups for insert
  with check (auth.uid() = created_by);

create policy "Group creator can update"
  on groups for update
  using (auth.uid() = created_by);

-- ============================================
-- RLS 정책: group_members
-- ============================================
create policy "Members can view group members"
  on group_members for select
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave groups"
  on group_members for delete
  using (auth.uid() = user_id);

-- ============================================
-- RLS 정책: group_routines
-- ============================================
create policy "Members can view group routines"
  on group_routines for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = group_routines.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Members can add routines to groups"
  on group_routines for insert
  with check (
    exists (
      select 1 from group_members
      where group_members.group_id = group_routines.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Members can remove routines from groups"
  on group_routines for delete
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = group_routines.group_id
      and group_members.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS 정책: verifications
-- ============================================
create policy "Users can view own verifications"
  on verifications for select
  using (auth.uid() = user_id);

create policy "Members can view group verifications"
  on verifications for select
  using (
    group_id is not null and
    exists (
      select 1 from group_members
      where group_members.group_id = verifications.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Users can create own verifications"
  on verifications for insert
  with check (auth.uid() = user_id);

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Storage: 인증 사진 업로드용 버킷
-- ============================================
insert into storage.buckets (id, name, public)
values ('verifications', 'verifications', true)
on conflict (id) do nothing;

create policy "Users can upload verification photos"
  on storage.objects for insert
  with check (
    bucket_id = 'verifications'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view verification photos"
  on storage.objects for select
  using (bucket_id = 'verifications');

-- ============================================
-- 인덱스 (성능 최적화)
-- ============================================
create index idx_routines_user_id on routines(user_id);
create index idx_group_members_user_id on group_members(user_id);
create index idx_group_members_group_id on group_members(group_id);
create index idx_verifications_user_id on verifications(user_id);
create index idx_verifications_routine_id on verifications(routine_id);
create index idx_verifications_group_id on verifications(group_id);
create index idx_verifications_verified_at on verifications(verified_at);
create index idx_groups_invite_code on groups(invite_code);
