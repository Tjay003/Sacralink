-- Foundation backup query for the PRODUCTION Supabase project (read-only: SELECTs only).
-- Run it through the Supabase MCP `execute_sql`, then:  node scripts/split-mcp-backup.mjs <saved-result> backups/foundation
-- Returns: schema_sql, functions_sql, data_sql, expected_counts.
-- Foundation rows = reference/configuration data and staff accounts. User activity is NOT included
-- (appointments, appointment_changes, appointment_documents, messages, conversations, participants, donations,
-- notifications, church_chat_logs, church_candle_prayers, church_favorites, activity_logs, announcements,
-- church_announcements, system_announcements, priest_availability, parish_applications, church_knowledge_chunks).
select
(select string_agg(ddl, E'\n' order by ord, tbl, sub) from (
  select 1 ord, c.relname::text tbl, '' sub,
    format('CREATE TABLE IF NOT EXISTS public.%I (%s);', c.relname,
      (select string_agg(format('%I %s%s%s', a.attname, format_type(a.atttypid,a.atttypmod),
          case when a.attnotnull then ' NOT NULL' else '' end,
          case when d.adbin is not null then ' DEFAULT '||pg_get_expr(d.adbin,d.adrelid) else '' end), ', ' order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
       where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)) ddl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
  union all
  select 2, conrelid::regclass::text, case contype when 'p' then '1' when 'u' then '2' when 'c' then '3' else '4' end || conname,
    format('ALTER TABLE %s ADD CONSTRAINT %I %s;', conrelid::regclass, conname, pg_get_constraintdef(oid))
  from pg_constraint where connamespace='public'::regnamespace and contype in ('p','u','c','f')
  union all
  select 3, tablename::text, indexname::text, indexdef || ';'
  from pg_indexes where schemaname='public' and indexname not in (select conname from pg_constraint where connamespace='public'::regnamespace)
  union all
  select 4, c.relname::text, '', format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', c.relname)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  union all
  select 5, tablename::text, policyname::text,
    format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', policyname, schemaname, tablename, permissive, cmd, array_to_string(roles, ', '),
      case when qual is not null then ' USING (' || qual || ')' else '' end,
      case when with_check is not null then ' WITH CHECK (' || with_check || ')' else '' end)
  from pg_policies where schemaname in ('public','storage')
) s) as schema_sql,
(select string_agg(ddl, E'\n\n' order by ord, nm) from (
  select 1 ord, p.proname::text nm, pg_get_functiondef(p.oid) || ';' ddl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
  union all
  select 2, c.relname::text || '.' || t.tgname::text, pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
  union all
  select 3, c.relname::text, case c.relkind when 'm' then format('CREATE MATERIALIZED VIEW IF NOT EXISTS public.%I AS %s', c.relname, pg_get_viewdef(c.oid)) else format('CREATE OR REPLACE VIEW public.%I AS %s', c.relname, pg_get_viewdef(c.oid)) end
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m')
  union all
  select 4, id::text, format('-- storage bucket: id=%L name=%L public=%s file_size_limit=%s', id, name, public, coalesce(file_size_limit::text,'null'))
  from storage.buckets
  union all
  select 5, pubname::text || '.' || tablename::text, format('-- realtime publication %s includes %s.%s', pubname, schemaname, tablename)
  from pg_publication_tables where schemaname='public'
) f) as functions_sql,
(select string_agg(l, E'\n') from (
  select format('INSERT INTO public.churches SELECT * FROM json_populate_record(NULL::public.churches, %L);', to_jsonb(t)::text) l from public.churches t
  union all select format('INSERT INTO public.profiles SELECT * FROM json_populate_record(NULL::public.profiles, %L);', to_jsonb(t)::text) from public.profiles t where t.role::text <> 'user'
  union all select format('INSERT INTO public.sacrament_requirements SELECT * FROM json_populate_record(NULL::public.sacrament_requirements, %L);', to_jsonb(t)::text) from public.sacrament_requirements t
  union all select format('INSERT INTO public.mass_schedules SELECT * FROM json_populate_record(NULL::public.mass_schedules, %L);', to_jsonb(t)::text) from public.mass_schedules t
  union all select format('INSERT INTO public.service_durations SELECT * FROM json_populate_record(NULL::public.service_durations, %L);', to_jsonb(t)::text) from public.service_durations t
  union all select format('INSERT INTO public.church_images SELECT * FROM json_populate_record(NULL::public.church_images, %L);', to_jsonb(t)::text) from public.church_images t
  union all select format('INSERT INTO public.church_knowledge_files SELECT * FROM json_populate_record(NULL::public.church_knowledge_files, %L);', to_jsonb(t)::text) from public.church_knowledge_files t
  union all select format('INSERT INTO public.church_knowledge_sections SELECT * FROM json_populate_record(NULL::public.church_knowledge_sections, %L);', to_jsonb(t)::text) from public.church_knowledge_sections t
) q) as data_sql,
(select json_object_agg(t, n) from (
  select 'churches' t, (select count(*) from public.churches) n
  union all select 'profiles', (select count(*) from public.profiles where role::text <> 'user')
  union all select 'sacrament_requirements', (select count(*) from public.sacrament_requirements)
  union all select 'mass_schedules', (select count(*) from public.mass_schedules)
  union all select 'service_durations', (select count(*) from public.service_durations)
  union all select 'church_images', (select count(*) from public.church_images)
  union all select 'church_knowledge_files', (select count(*) from public.church_knowledge_files)
  union all select 'church_knowledge_sections', (select count(*) from public.church_knowledge_sections)
) z) as expected_counts;
