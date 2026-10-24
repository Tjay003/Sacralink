-- Migration 083: Church Knowledge Base schema parity
-- Brings church_knowledge_chunks, church_knowledge_sections, church_knowledge_files,
-- and match_church_knowledge from production foundation into local migration pipeline.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.church_knowledge_chunks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    content text NOT NULL,
    embedding vector(768),
    source_type text NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT church_knowledge_chunks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.church_knowledge_files (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_url text NOT NULL,
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT church_knowledge_files_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.church_knowledge_sections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL DEFAULT ''::text,
    display_order integer DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT church_knowledge_sections_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS church_knowledge_chunks_embedding_idx
    ON public.church_knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.church_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_knowledge_sections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_chunks' AND policyname = 'Anyone can read knowledge chunks') THEN
        CREATE POLICY "Anyone can read knowledge chunks" ON public.church_knowledge_chunks
            FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_chunks' AND policyname = 'Only admins can modify knowledge chunks') THEN
        CREATE POLICY "Only admins can modify knowledge chunks" ON public.church_knowledge_chunks
            FOR ALL TO authenticated USING (
                get_current_user_role() = ANY (ARRAY['admin'::text, 'super_admin'::text, 'church_admin'::text])
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_files' AND policyname = 'Anyone can read church knowledge files') THEN
        CREATE POLICY "Anyone can read church knowledge files" ON public.church_knowledge_files
            FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_files' AND policyname = 'Church admins can delete knowledge files') THEN
        CREATE POLICY "Church admins can delete knowledge files" ON public.church_knowledge_files
            FOR DELETE TO public USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND (
                        profiles.role = 'super_admin'::user_role
                        OR ((profiles.role = 'church_admin'::user_role OR profiles.role = 'admin'::user_role)
                            AND (profiles.church_id = church_knowledge_files.church_id OR profiles.assigned_church_id = church_knowledge_files.church_id))
                    )
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_files' AND policyname = 'Church admins can upload knowledge files') THEN
        CREATE POLICY "Church admins can upload knowledge files" ON public.church_knowledge_files
            FOR INSERT TO public WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND (
                        profiles.role = 'super_admin'::user_role
                        OR ((profiles.role = 'church_admin'::user_role OR profiles.role = 'admin'::user_role)
                            AND (profiles.church_id = church_knowledge_files.church_id OR profiles.assigned_church_id = church_knowledge_files.church_id))
                    )
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_sections' AND policyname = 'Public read knowledge sections') THEN
        CREATE POLICY "Public read knowledge sections" ON public.church_knowledge_sections
            FOR SELECT TO public USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_sections' AND policyname = 'Admins can delete knowledge sections') THEN
        CREATE POLICY "Admins can delete knowledge sections" ON public.church_knowledge_sections
            FOR DELETE TO public USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND (
                        profiles.role = 'super_admin'::user_role
                        OR (profiles.role = ANY (ARRAY['church_admin'::user_role, 'admin'::user_role])
                            AND (profiles.church_id = church_knowledge_sections.church_id OR profiles.assigned_church_id = church_knowledge_sections.church_id))
                    )
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_sections' AND policyname = 'Admins can insert knowledge sections') THEN
        CREATE POLICY "Admins can insert knowledge sections" ON public.church_knowledge_sections
            FOR INSERT TO public WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND (
                        profiles.role = 'super_admin'::user_role
                        OR (profiles.role = ANY (ARRAY['church_admin'::user_role, 'admin'::user_role])
                            AND (profiles.church_id = church_knowledge_sections.church_id OR profiles.assigned_church_id = church_knowledge_sections.church_id))
                    )
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'church_knowledge_sections' AND policyname = 'Admins can update knowledge sections') THEN
        CREATE POLICY "Admins can update knowledge sections" ON public.church_knowledge_sections
            FOR UPDATE TO public USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND (
                        profiles.role = 'super_admin'::user_role
                        OR (profiles.role = ANY (ARRAY['church_admin'::user_role, 'admin'::user_role])
                            AND (profiles.church_id = church_knowledge_sections.church_id OR profiles.assigned_church_id = church_knowledge_sections.church_id))
                    )
                )
            );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.match_church_knowledge(query_embedding vector, match_church_id uuid, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, content text, source_type text, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        ckc.id,
        ckc.content,
        ckc.source_type,
        1 - (ckc.embedding <=> query_embedding) AS similarity
    FROM church_knowledge_chunks ckc
    WHERE ckc.church_id = match_church_id
      AND ckc.embedding IS NOT NULL
    ORDER BY ckc.embedding <=> query_embedding
    LIMIT match_count;
END;
$function$;
