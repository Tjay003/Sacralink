-- ============================================
-- AVATARS STORAGE BUCKET SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket so avatars can be displayed
  524288,  -- 512KB max file size (after compression)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']  -- Allowed types
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Policy: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. Policy: Anyone can view avatars (public read)
CREATE POLICY "Public avatar access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the bucket was created:
-- SELECT * FROM storage.buckets WHERE id = 'avatars';

-- Run this to verify policies are set:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
