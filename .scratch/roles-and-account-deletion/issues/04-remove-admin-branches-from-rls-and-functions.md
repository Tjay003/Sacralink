# 04: Remove Admin branches from RLS and database functions

Type: task
Status: needs-info
**Blocked by:** 02, and migration 052 (`052_approve_reject_functions_and_lockdown.sql`) applied to production

**What to build:** A cleanup migration that rewrites policies and functions whose role checks mention `'admin'` so they only reference `super_admin` and `church_admin` (and priest/volunteer where already present). After ticket 02 no row has the role, so these branches are dead code; this ticket removes the confusion and the risk of someone reintroducing the value. Affected, from `grep -c "'admin'" supabase/migrations/*.sql`: profile helper policies (`024`, `025`), churches and church images (`010`, `016`, `038`), sacrament requirements (`009`), parish applications (`026`), messaging and tickets (`027`, `032`, `033`, `036`, `040`, `041`, `059`), donations (`034`), church announcements (`043`), mass schedules (`007`, `058`), and the appointment functions and policies (`046` to `052`, `055`, `056`, `060`).

Use `CREATE OR REPLACE` for functions and `DROP POLICY IF EXISTS` / `CREATE POLICY` for policies in one new migration; never edit old migration files. Also tighten the `Church admins can update their church members` policy only if ticket 05 has not already replaced it.

**Why `needs-info`:** this must not run before 052 is live in production. The appointment functions and policies it rewrites are exactly the ones 052 introduces, and the pending lockdown release is the user's call. Re-triage to `ready-for-agent` once 052 is applied.

- [ ] No policy or function definition in the live database references `'admin'` (query `pg_policies` and `pg_proc` source to verify).
- [ ] Behavior of every rewritten policy for super_admin, church_admin, priest, volunteer and parishioner is unchanged (the whole local suite is the regression net).
- [ ] The migration is idempotent and appended to `APPLY_ALL_MIGRATIONS.sql`.

**Test plan:** run the full `npm run test:e2e:local` suite (this ticket is wide enough to need it), serialized with other agents. Add one test that queries `pg_policies` through the service client and asserts no `qual` or `with_check` contains `'admin'::user_role`. Production apply from the main conversation only, after backup.
