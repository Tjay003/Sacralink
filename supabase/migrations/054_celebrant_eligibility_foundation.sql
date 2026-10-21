-- ==============================================================================
-- MIGRATION 054: Celebrant eligibility foundation
-- One server-side answer to "who presides where, and is this priest free?".
-- The approval and celebrant-change flows, the public clergy roster and the booking
-- pool check all read these functions instead of computing it in the browser.
--
-- 1. mass_schedules.presiding_priest_id: the priest who normally presides at a
--    recurring Mass. It is a weekly default, not a per-occurrence assignment.
-- 2. get_parish_clergy(p_church_id): the parish roster with a computed status
--    (available | in_mass | on_leave). Callable by anon and authenticated.
-- 3. evaluate_parish_celebrants(p_church_id, p_date, p_time, p_exclude_appointment_id):
--    per-priest eligibility, badge, daily count and warnings for one slot.
--    Callable by authenticated only.
-- 4. check_parish_slot(p_church_id, p_date, p_time): whether the slot is taken and
--    whether at least one priest is eligible. Callable by authenticated only.
--
-- Rules (settled in the client-enhancements grilling):
--   * A priest belongs to a parish when profiles.assigned_church_id OR church_id matches
--     and (is_priest = true OR role = 'priest').
--   * A parish with no priests has no priest constraint (everything is eligible).
--   * A priest's day commitments are his appointments (not cancelled or rejected) plus the
--     recurring Masses he presides at on that weekday. They drive the time collision check
--     (same HH:MM) and the Canon 905 limit (weekday 2, Sunday 3).
--   * Day off and leave come from priest_availability.day_of_week / blackout_start /
--     blackout_end keyed by priest_id (the columns the priest dashboard writes).
--
-- Every function is SECURITY DEFINER and returns computed status only. The leave reason
-- (priest_availability.reason), email and phone number are never returned.
-- ASCII only: the section sign of the Canon 905 warnings is built with chr(167) so the file
-- survives any shell encoding when it is piped into psql.
-- ==============================================================================

-- 1. Presiding priest on a recurring Mass
ALTER TABLE public.mass_schedules
  ADD COLUMN IF NOT EXISTS presiding_priest_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mass_schedules_presiding_priest
  ON public.mass_schedules(presiding_priest_id)
  WHERE presiding_priest_id IS NOT NULL;

-- 2. Internal helper: does a mass_schedules.day_of_week label fall on this weekday index?
--    The column is text ('Sunday', 'Mon', or a legacy '0'-'6'); 0 = Sunday ... 6 = Saturday.
CREATE OR REPLACE FUNCTION public.mass_runs_on_weekday(p_label TEXT, p_dow INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(p_label) = p_dow::text
      OR lower(left(btrim(p_label), 3)) = lower(left((ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[p_dow + 1], 3));
$$;

REVOKE ALL ON FUNCTION public.mass_runs_on_weekday(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- 3. get_parish_clergy
--    "Today" and "now" are read in Philippine time, the timezone of every parish served.
--    A priest is in_mass for the hour after a Mass he presides at starts.
CREATE OR REPLACE FUNCTION public.get_parish_clergy(p_church_id UUID)
RETURNS TABLE (
  priest_id UUID,
  name TEXT,
  title TEXT,
  designation TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH local_now AS (
    SELECT (now() AT TIME ZONE 'Asia/Manila') AS ts
  ),
  today AS (
    SELECT ts::date AS d, ts::time AS t, extract(dow FROM ts)::integer AS dow
    FROM local_now
  )
  SELECT
    pr.id,
    COALESCE(
      NULLIF(btrim(regexp_replace(btrim(COALESCE(pr.full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
      'Clergy Member'
    ),
    'Rev. Fr.'::text,
    CASE WHEN pr.role::text = 'priest' THEN 'Priest' ELSE 'Parish Administrator' END,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pr.id
          AND (pa.day_of_week = today.dow
               OR (pa.blackout_start IS NOT NULL AND pa.blackout_end IS NOT NULL
                   AND today.d BETWEEN pa.blackout_start AND pa.blackout_end))
      ) THEN 'on_leave'
      WHEN EXISTS (
        SELECT 1 FROM public.mass_schedules m
        WHERE m.presiding_priest_id = pr.id
          AND public.mass_runs_on_weekday(m.day_of_week, today.dow)
          AND today.t - m.time >= interval '0'
          AND today.t - m.time < interval '1 hour'
      ) THEN 'in_mass'
      ELSE 'available'
    END
  FROM public.profiles pr
  CROSS JOIN today
  WHERE (pr.assigned_church_id = p_church_id OR pr.church_id = p_church_id)
    AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ORDER BY 2, 1;
$$;

REVOKE ALL ON FUNCTION public.get_parish_clergy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parish_clergy(UUID) TO anon, authenticated;

-- 4. evaluate_parish_celebrants
--    Mirrors the browser-side evaluateCelebrantAssignment: day off / leave, exact time collision,
--    Canon 905 daily limit, with the same badges and warnings, now counting recurring Masses too.
--    p_exclude_appointment_id leaves the appointment being edited out of the priest's own load.
--    A null p_time skips the time collision check.
CREATE OR REPLACE FUNCTION public.evaluate_parish_celebrants(
  p_church_id UUID,
  p_date DATE,
  p_time TIME,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  priest_id UUID,
  eligible BOOLEAN,
  status TEXT,
  badge_text TEXT,
  badge_variant TEXT,
  warnings TEXT[],
  daily_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_dow INTEGER;
  v_is_sunday BOOLEAN;
  v_max INTEGER;
  v_day_name TEXT;
  v_target TEXT := to_char(p_time, 'HH24:MI');
  v_pretty_time TEXT := to_char(p_time, 'FMHH12:MI AM');
  v_section TEXT := chr(167);
BEGIN
  IF p_church_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;

  v_dow := extract(dow FROM p_date)::integer;
  v_is_sunday := v_dow = 0;
  v_max := CASE WHEN v_is_sunday THEN 3 ELSE 2 END;
  v_day_name := (ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[v_dow + 1];

  RETURN QUERY
  WITH pool AS (
    SELECT pr.id AS pid, COALESCE(pr.full_name, '') AS pname
    FROM public.profiles pr
    WHERE (pr.assigned_church_id = p_church_id OR pr.church_id = p_church_id)
      AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ),
  commitments AS (
    SELECT a.priest_id AS pid, a.appointment_time AS t, COALESCE(a.service_type, 'Sacrament') AS label
    FROM public.appointments a
    WHERE a.appointment_date = p_date
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'rejected')
      AND a.priest_id IN (SELECT pid FROM pool)
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
    UNION ALL
    SELECT m.presiding_priest_id, m.time, 'Mass'
    FROM public.mass_schedules m
    WHERE m.presiding_priest_id IN (SELECT pid FROM pool)
      AND public.mass_runs_on_weekday(m.day_of_week, v_dow)
  ),
  tally AS (
    SELECT
      pool.pid,
      pool.pname,
      (SELECT count(*) FROM commitments c WHERE c.pid = pool.pid)::integer AS n,
      (SELECT c.label FROM commitments c
        WHERE c.pid = pool.pid AND v_target IS NOT NULL AND to_char(c.t, 'HH24:MI') = v_target
        ORDER BY c.t LIMIT 1) AS clash_label,
      EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pool.pid AND pa.day_of_week = v_dow
      ) AS day_off,
      EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pool.pid
          AND pa.blackout_start IS NOT NULL AND pa.blackout_end IS NOT NULL
          AND p_date BETWEEN pa.blackout_start AND pa.blackout_end
      ) AS on_leave
    FROM pool
  ),
  scored AS (
    SELECT t.*, (t.n >= v_max) AS canon, (t.clash_label IS NOT NULL) AS clash
    FROM tally t
  )
  SELECT
    s.pid,
    NOT (s.day_off OR s.on_leave OR s.clash OR s.canon),
    CASE
      WHEN s.day_off OR s.on_leave THEN 'blackout'
      WHEN s.clash THEN 'busy'
      WHEN s.canon THEN 'canon_limit'
      ELSE 'available'
    END,
    CASE
      WHEN s.day_off THEN 'Day Off'
      WHEN s.on_leave THEN 'Unavailable / Leave'
      WHEN s.clash THEN 'Time Collision'
      WHEN s.canon THEN 'Canon 905 Limit (' || s.n || '/' || v_max || ')'
      WHEN s.n > 0 THEN s.n || ' scheduled'
      ELSE 'Available (0 commitments)'
    END,
    CASE
      WHEN s.day_off OR s.on_leave OR s.clash OR s.canon THEN 'destructive'
      WHEN s.n > 0 THEN 'warning'
      ELSE 'success'
    END,
    array_remove(ARRAY[
      CASE
        WHEN s.day_off THEN 'Father is on his weekly day off (' || v_day_name || ').'
        WHEN s.on_leave THEN 'Father is away on clergy leave or retreat.'
      END,
      CASE
        WHEN s.clash THEN 'Temporal Conflict: Father is already presiding another liturgy ('
          || s.clash_label || ') at ' || v_pretty_time || '.'
      END,
      CASE
        WHEN s.canon THEN 'Canon 905 Admonition: Father already has ' || s.n || ' liturgical celebration'
          || CASE WHEN s.n > 1 THEN 's' ELSE '' END || ' scheduled on this '
          || CASE WHEN v_is_sunday
               THEN 'Sunday (maximum 3 allowed by Canon 905 ' || v_section || '2)'
               ELSE 'weekday (maximum 2 allowed by Canon 905 ' || v_section || '1)' END || '.'
        WHEN s.n > 0 THEN 'Father already has ' || s.n || ' liturgical celebration'
          || CASE WHEN s.n > 1 THEN 's' ELSE '' END || ' scheduled on this day ('
          || s.n || '/' || v_max || ' Canon 905 threshold).'
      END
    ], NULL),
    s.n
  FROM scored s
  ORDER BY s.n, s.pname, s.pid;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_parish_celebrants(UUID, DATE, TIME, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_parish_celebrants(UUID, DATE, TIME, UUID) TO authenticated;

-- 5. check_parish_slot
--    slot_taken mirrors the booking page rule: any pending or approved request at the parish
--    for that date and time (cancelled and rejected requests free the slot). Row level security
--    hides other parishioners' bookings from the browser, which is why this runs here.
--    has_eligible_priest is true when at least one priest of the parish is eligible, and also
--    when the parish has no priests (priest_count = 0), so callers fall back to slot logic.
CREATE OR REPLACE FUNCTION public.check_parish_slot(
  p_church_id UUID,
  p_date DATE,
  p_time TIME
)
RETURNS TABLE (
  slot_taken BOOLEAN,
  has_eligible_priest BOOLEAN,
  priest_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_taken BOOLEAN;
  v_total INTEGER;
  v_eligible INTEGER;
BEGIN
  v_taken := p_church_id IS NOT NULL AND p_date IS NOT NULL AND p_time IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.church_id = p_church_id
      AND a.appointment_date = p_date
      AND to_char(a.appointment_time, 'HH24:MI') = to_char(p_time, 'HH24:MI')
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'rejected')
  );

  SELECT count(*)::integer, (count(*) FILTER (WHERE e.eligible))::integer
    INTO v_total, v_eligible
  FROM public.evaluate_parish_celebrants(p_church_id, p_date, p_time) e;

  RETURN QUERY SELECT v_taken, (v_total = 0 OR v_eligible > 0), v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.check_parish_slot(UUID, DATE, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_parish_slot(UUID, DATE, TIME) TO authenticated;
