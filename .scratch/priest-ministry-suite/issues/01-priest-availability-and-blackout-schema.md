# Issue 01: Priest Availability & Blackout Schema

Type: task
Status: resolved
Blocked by: none

---

## 1. Description
Provide the database foundation for priests to record their recurring weekly day-off and specific blackout leave periods (diocesan clergy retreats, personal sick leave, canonical study leave).

### Requirements:
1. **Migration File (`042_create_priest_availability.sql`)**:
   - Create table `public.priest_availability`:
     - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
     - `priest_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
     - `church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE`
     - `day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6)` (Optional recurring day off: 0 = Sunday, 1 = Monday, etc.)
     - `blackout_start DATE`
     - `blackout_end DATE`
     - `reason TEXT NOT NULL DEFAULT 'Clergy Retreat / Leave'`
     - `created_at TIMESTAMPTZ DEFAULT NOW()`
     - `updated_at TIMESTAMPTZ DEFAULT NOW()`
   - RLS Policies:
     - Priests can view, insert, update, and delete their own availability records (`auth.uid() = priest_id`).
     - Church Admins and Super Admins can view priest availability for scheduling.
2. **TypeScript Types & Supabase Client Helper**:
   - Update `web/src/types/database.ts`.
   - Create `web/src/lib/supabase/priestAvailability.ts`:
     - `getPriestAvailability(priestId: string)`
     - `upsertDayOff(priestId: string, churchId: string | null, dayOfWeek: number | null)`
     - `addBlackoutPeriod(priestId: string, churchId: string | null, start: string, end: string, reason: string)`
     - `deleteBlackoutPeriod(id: string)`
     - `checkPriestIsAvailable(priestId: string, dateStr: string): Promise<{ available: boolean; reason?: string }>`

---

## 2. Acceptance Criteria
- [x] Database migration created and verified.
- [x] RLS policies properly secure priest availability rows.
- [x] Supabase helper functions implemented with complete TypeScript types.
- [x] `npm --prefix web run build` succeeds with zero errors.
