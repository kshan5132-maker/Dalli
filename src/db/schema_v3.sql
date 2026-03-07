-- ============================================
-- Dalli (달리) Database Schema v3 - 개발용 (RLS 비활성화)
-- ============================================
-- *** Supabase SQL Editor에서 실행하세요 ***
--
-- 실행 방법:
-- 1. Supabase 대시보드 (https://supabase.com/dashboard) 접속
-- 2. 프로젝트 선택 -> SQL Editor 메뉴 클릭
-- 3. "New query" 클릭
-- 4. 이 파일의 전체 내용을 복사하여 붙여넣기
-- 5. "Run" 버튼 클릭
-- 6. 모든 테이블과 정책이 생성되었는지 Table Editor에서 확인
--
-- 주의: 이 스키마는 개발 단계용입니다.
-- - 기존 테이블을 모두 DROP 후 재생성합니다 (데이터 초기화됨)
-- - RLS가 비활성화되어 있으므로 프로덕션 배포 전에 RLS를 다시 활성화해야 합니다.
-- - group_routines 테이블은 제거되었습니다 (routines.group_id로 대체)
-- - messages 테이블이 추가되었습니다 (그룹 채팅용)
--
-- 변경사항 (v2 -> v3):
-- 1. routines: type 컬럼 추가 ('personal' | 'group'), group_id 컬럼 추가
-- 2. groups: settlement_cycle, settlement_day 컬럼 추가
-- 3. group_members: role 컬럼 추가 ('admin' | 'member')
-- 4. verifications: memo 컬럼 추가
-- 5. group_routines 테이블 제거 (routines.group_id로 직접 연결)
-- 6. messages 테이블 추가 (그룹 채팅)
-- ============================================

-- UUID 생성 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 기존 테이블 DROP (의존성 순서 역순)
-- ============================================
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS group_routines CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS routines CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 테이블 생성
-- ============================================

-- 1. profiles (사용자 프로필)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. groups (그룹)
CREATE TABLE groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  penalty_amount INT DEFAULT 10000,
  settlement_cycle TEXT DEFAULT 'weekly' CHECK (settlement_cycle IN ('weekly', 'monthly')),
  settlement_day TEXT DEFAULT 'sunday',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. routines (루틴 - 개인 루틴 & 그룹 루틴 통합)
CREATE TABLE routines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends')),
  verification_type TEXT NOT NULL DEFAULT 'photo' CHECK (verification_type IN ('photo', 'check')),
  type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'group')),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. group_members (그룹 멤버)
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- 5. verifications (인증 기록)
CREATE TABLE verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  routine_id UUID REFERENCES routines(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  photo_url TEXT,
  memo TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. messages (그룹 채팅)
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- RLS 비활성화 (개발 단계)
-- ============================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE routines DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 트리거: 회원가입 시 프로필 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- Storage: 인증 사진 업로드용 버킷
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 제거 후 재생성
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%verification%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 개발용 Storage 정책
CREATE POLICY "Dev: anyone can upload to verifications"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verifications');

CREATE POLICY "Dev: anyone can view verifications"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verifications');

-- ============================================
-- Realtime 활성화 (채팅용)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- 인덱스 (성능 최적화)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_group_id ON routines(group_id);
CREATE INDEX IF NOT EXISTS idx_routines_type ON routines(type);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_routine_id ON verifications(routine_id);
CREATE INDEX IF NOT EXISTS idx_verifications_group_id ON verifications(group_id);
CREATE INDEX IF NOT EXISTS idx_verifications_verified_at ON verifications(verified_at);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
