-- Local-only: storage pieces that production has but no migration creates (they were made in the dashboard).
-- Without them a plain parishioner cannot upload the Celebret and decree on the parish application form locally.
-- Run by scripts/local-db-setup.ps1 after the migrations. Never run against production.
INSERT INTO storage.buckets (id, name, public)
VALUES ('appointment-documents', 'appointment-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'church-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can upload appointment documents" ON storage.objects;
CREATE POLICY "Users can upload appointment documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'appointment-documents' AND auth.role() = 'authenticated');

-- The form uploads with upsert: true, which Storage runs as INSERT ... ON CONFLICT, so it also needs read access.
DROP POLICY IF EXISTS "Public can view parish upload buckets" ON storage.objects;
CREATE POLICY "Public can view parish upload buckets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('church-images', 'appointment-documents'));
