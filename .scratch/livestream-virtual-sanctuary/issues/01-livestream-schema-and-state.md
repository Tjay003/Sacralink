# 01: Livestream Schema & State Migration

Type: task
Status: resolved
Blocked by: none

## Summary
Add database schema support for livestream state, broadcast metadata, and virtual candle prayer tracking.

## Scope & Implementation Details
1. Create a new migration file `supabase/migrations/027_livestream_virtual_sanctuary.sql`:
   - Add columns to `churches` table:
     - `is_live`: `BOOLEAN DEFAULT false`
     - `livestream_title`: `TEXT`
     - `livestream_platform`: `TEXT DEFAULT 'facebook'`
     - `candle_count`: `INTEGER DEFAULT 0`
     - `livestream_started_at`: `TIMESTAMPTZ`
   - Create `church_candle_prayers` table (for tracking individual/anonymous candle intentions):
     - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
     - `church_id`: `UUID REFERENCES churches(id) ON DELETE CASCADE`
     - `user_id`: `UUID REFERENCES profiles(id) ON DELETE SET NULL`
     - `intention_text`: `TEXT`
     - `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
   - Create atomic RPC function `light_church_candle(target_church_id UUID, user_intention TEXT)`:
     - Increments `churches.candle_count`.
     - Inserts a record into `church_candle_prayers`.
     - Returns updated total candle count.
   - Set up RLS policies (allow authenticated/anon read, allow authenticated insert).
2. Update `supabase/migrations/APPLY_ALL_MIGRATIONS.sql` and `web/src/types/database.ts`.

## Acceptance Criteria
- [x] Migration applies cleanly with default values.
- [x] `light_church_candle` RPC increments count and logs prayer intention.
- [x] RLS policies permit public view and secured mutation.

## Resolution
- Created `supabase/migrations/027_livestream_virtual_sanctuary.sql` containing schema alterations, RLS policies, index optimizations, and `light_church_candle` RPC function.
- Appended migration script to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`.
- Updated TypeScript definitions in `web/src/types/database.ts` and `shared/types.ts` with typed `is_live`, `livestream_title`, `livestream_platform`, `candle_count`, `livestream_started_at`, `church_candle_prayers` table, and `light_church_candle` RPC function.
