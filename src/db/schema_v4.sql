-- ============================================
-- Dalli (달리) Database Schema v4 - 마이그레이션
-- ============================================
-- *** Supabase SQL Editor에서 실행하세요 ***
--
-- 변경사항 (v3 -> v4):
-- 1. groups 테이블에 avatar_url 컬럼 추가 (그룹 프로필 사진)
-- 2. avatars Storage 버킷 추가 (프로필/그룹 사진 업로드용)
-- ============================================

-- 1. groups 테이블에 avatar_url 컬럼 추가
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. avatars Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- avatars Storage 정책
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%avatar%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Dev: anyone can upload to avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Dev: anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Dev: anyone can update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Dev: anyone can delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');
