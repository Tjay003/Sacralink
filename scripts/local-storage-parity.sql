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

-- church_chat_logs parity (existing in production foundation, needed locally)
CREATE TABLE IF NOT EXISTS public.church_chat_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.church_chat_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read all chat logs" ON public.church_chat_logs;
CREATE POLICY "Admins can read all chat logs" ON public.church_chat_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((get_current_user_role() = ANY (ARRAY['admin'::text, 'super_admin'::text, 'church_admin'::text])));
DROP POLICY IF EXISTS "Anyone authenticated can insert chat logs" ON public.church_chat_logs;
CREATE POLICY "Anyone authenticated can insert chat logs" ON public.church_chat_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can read their own chat logs" ON public.church_chat_logs;
CREATE POLICY "Users can read their own chat logs" ON public.church_chat_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
