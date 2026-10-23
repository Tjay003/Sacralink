# Handoff: roles, account deletion and tickets

For a fresh session after `/clear`. Read this file first, then `spec.md` (section 0 and the decisions table), `map.md`, and the ticket you are about to build. `TESTING-GUIDE.md` is Tyrone's manual test script; keep it in step with what you build.

## 1. Rules to remember (project and Tyrone)

- **Branches** (`AGENTS.md`): `main` is for building, integration, staging and automated tests. `feature/demo-mode` is production (Vercel deploys it). Never mistake `main` for production.
- **Release order:** test on `main`, push `main`, wait for the GitHub check, **then** merge `main` into `feature/demo-mode`, and ask before pushing the production branch. Never the reverse. Do not `git checkout` the production branch while other uncommitted work is in the tree (use `git branch -f feature/demo-mode main` then push, as in the memory notes).
- **Local Docker Supabase only** for backend testing (`docs/agents/local-testing.md`). `web/.env` points at **production**: never test against it. The app for manual testing is `cd web; npx vite --mode e2e --port 5174` (localhost:5173 talks to production).
- **One e2e agent at a time.** The local database and port 5174 are shared. Stop a stale dev server on 5174 before a run. Run only your area: `cd web; npx playwright test -c playwright.local.config.ts e2e-local/<file>.spec.ts` (`docs/agents/test-workflow.md`: 3 to 8 tests per ticket, risky parts plus one happy path, no tests for wording or layout). The mocked suite `web/e2e` is not part of any gate; leave it alone.
- **Production migrations** are applied only from the main conversation, never by a subagent: relevant local spec passes, back up first when existing data changes (the free plan means a manual snapshot; never commit data, the repo is public), apply, verify with read-only queries. Ticket 02 rewrites production roles, so back up `profiles` first.
- **Commits:** clear descriptive messages. **No agent co-author trailers and no "Generated with Claude Code" lines** (this overrides the default attribution). Never commit data.
- **Shell:** PowerShell syntax (`;` not `&&`) in the PowerShell tool; POSIX in Git Bash. The Grep tool fails here (ripgrep is missing); use Bash `grep`. Bash heredocs with unusual quoting have failed repeatedly; write helper scripts to a file instead.
- **Delegation** (Tyrone's standing preference): one fresh subagent per ticket, parallel when it shortens the work, e2e serialized. Every subagent must self-test end to end and run static validation before reporting, and report modified file paths plus test status in a structured handoff.
- **Design system:** follow `AGENTS.md` (Sacralink theme, light mode, `.card`, tokens in `web/src/index.css`); no dark-only slate classes.
- **Never commit or revert Tyrone's parked work:** `.scratch/reset-password-email.html`, `.scratch/reset-password-email-single-quotes.html`, `.scratch/client-concerns-oct22/` (a separate effort for another session) and any uncommitted web edits that belong to it. The untracked `.agents/skills/` folders are also not yours to commit. The memory notes say `supabase/migrations/APPLY_ALL_MIGRATIONS.sql` and `web/src/types/database.ts` once carried his uncommitted edits mixed with ours: run `git status` and `git diff` on them before touching, and commit only your own hunks (temporary `GIT_INDEX_FILE` if needed).
- **Skills:** `/grill-with-docs`, `/to-spec` and `/to-tickets` exist under `.agents/skills/` (the `.claude/skills` junction points there). The old session did not register them; a fresh session should.

## 2. What is already done

Committed on `main` (not pushed when this was written: `git status -sb` showed `ahead 2`; check before assuming):

- `8c8fe0a` dashboard: removed the appointment-based cards from the Super Admin stats, renamed Pending Sacraments to **Pending Requests** and Sacraments Celebrated to **Services Completed**.
- `fed05ea` replaced Diocese and Chancery wording with San Jose del Monte and church terms, renamed Parishes to **Churches** and Parish applications to **Church Applications**, and renamed the sidebar group to **Management**.

Nothing else from this work is built. Everything below is design only: `spec.md`, `map.md` and 20 ticket files exist, with **no code written and no migrations created**.

## 3. What is decided

All design decisions are closed. The single source of truth is `spec.md`:

- **Section 0**: the Direct-message matrix (who can start a chat with whom) and the ticket visibility matrix by stage.
- **Section 2, decisions 1 to 40**: roles, deletion, tickets, privacy, escalation stub, legacy chats, concern route, limits, staff cleanup.
- **Section 8**: accepted defaults (listed so Tyrone can still veto them).

The headline rules, so you do not have to re-derive them: the Admin role is removed (admins become Parishioners); role changes are enforced in the database; deletion means anonymize in place (history kept, shown as "Deleted User"); the Super Admin is one shared account that cannot delete or suspend itself; tickets have a church lane and a platform lane with strict privacy (the Super Admin sees a church ticket only after escalation, after escalation the Church Admin sees only a content-free stub); suspend and delete cut a signed-in user off immediately through the RLS helpers plus a restrictive policy on every table.

## 4. Tickets and dependencies

`10` was split into **10a** (ticket data model, lanes, `create_ticket`, limits, concern category) and **10b** (the Direct-message rule). 12 depends on 10b because its contact picker and banner read `may_start_direct` and `direct_is_legacy`; 11 does not.

| Ticket | Summary | Blocked by | Touches DB |
|---|---|---|---|
| 01 | Remove Large Text mode | none | no |
| 02 | Admin role data migration and transfer fix | none | yes |
| 03 | Remove Admin role from the web app | 02 | no |
| 04 | Remove Admin branches from RLS/functions | 02, **052 in production** | yes |
| 05 | Database-enforced role changes (+ staff channel cleanup hook) | 02 | yes |
| 06 | Role editing and demotion UI | 05 | no |
| 07 | Super Admin deletes a user; instant cut-off mechanism; no messages to blocked users | 02, 05 | yes |
| 08 | "Deleted User" display everywhere | 07 | no |
| 09 | Self-delete with safeguards | 05, 07, 08 | yes |
| 10a | Ticket model, lanes, `create_ticket`, limits, concern route | 02 | yes |
| 10b | Direct-message matrix, creation function, legacy chats | 02 | yes |
| 11 | Ticket permissions, status function, auto status | 10a | yes |
| 12 | Tickets tab, role-correct UI, stub row, pickers, banners | 10b, 11 | small |
| 13 | Ticket assignment (+ staff-removal unassign) | 05, 11, 12 | yes |
| 14 | Escalation, stub function, send back, 7-day review | 11, 12 | yes |
| 15 | Reopen limit and linked follow-up | 11, 12 | yes |
| 16 | Ticket notifications and Tickets-tab badge | 13, 14, 15 | yes |
| 17 | Request-user-deletion ticket | 07, 10a, 12 | yes |
| 18 | Super Admin review summary | 17, 19 | yes |
| 19 | Suspend and reactivate | 07 | yes |
| 20 | Delete/Suspend/Decline on a deletion request | 07, 16, 18, 19 | yes |

(Checked against the blocked-by lines in every ticket file; no cycles.)

## 5. Recommended build order

Waves are dependency levels; inside a wave tickets are independent of each other.

| Wave | Tickets | Notes |
|---|---|---|
| 1 | 01, 02 | 01 is web only, 02 is a migration: author both at once. |
| 2 | 03, 05, 10a, 10b | 03 is web only. 05, 10a, 10b each add migrations. |
| 3 | 06, 07, 11 | 06 is web only (needs 05). 07 is large and wide (runs a restrictive policy on every table): run the **full** local suite after it. |
| 4 | 08, 19, 12 | 08 and 12 are mostly web. |
| 5 | 09, 13, 14, 15, 17 | all DB plus UI. |
| 6 | 16, 18 | |
| 7 | 20 | |
| last | 04 | only after 052 has reached production. |

**What can run in parallel and what must be serial**

- **Authoring can be parallel** (separate git worktrees, one subagent per ticket): writing code, migration files, specs and types. This is where parallelism saves time: pairs like 01 with 02, 03 with 05, 06 with 07, 08 with 19, and 13/14/15 together.
- **Integration is strictly serial**: applying a migration to the shared local database and running e2e. One ticket at a time: rebase on the testing branch, apply the migration, run its spec, merge, then the next. Two agents must never run e2e or migrations at once.
- **Migration numbers:** the last existing migration is `061`. Assign numbers up front when you dispatch, in build order (for example 02=062, 05=063, 10a=064, 10b=065, 07=066, 11=067, 19=068, 13=069, 14=070, 15=071, 17=072, 09=073, 16=074, 18=075, 20=076, 04=077), but run `ls supabase/migrations` first: Tyrone's other effort (`.scratch/client-concerns-oct22`) may use numbers too. Record the assignment in `map.md`.
- **Shared files** (`APPLY_ALL_MIGRATIONS.sql`, `web/src/types/database.ts`, `MessagingPage.tsx`, `messaging.ts`) will conflict between parallel tickets. Tell subagents **not** to edit `APPLY_ALL_MIGRATIONS.sql`: the coordinator appends in order at merge time. Keep their edits to the other shared files minimal and expect to resolve conflicts at merge.
- Tickets 11 and 10b both add policies on `messages` (separate policies, so they do not collide) and 07 adds another; they only need to be applied in order.
- Ticket 12 is the largest UI ticket (list narrowing, stub row, pickers, banners, review button, forms). Split it if the agent runs long: for example 12a (list, tab, dropdown, stub) and 12b (pickers, banners, forms).

**Pipeline Tyrone agreed on** (memory, 2026-10-22): make a testing branch from `main` (for example `feature/roles-and-tickets`); one fresh subagent per ticket; typecheck, build and the full local suite once at the end; Tyrone tests by hand on the **local** stack with `TESTING-GUIDE.md`; **migrations stay local until he says "merge it"**; then: back up, apply to production from the main conversation, fast-forward and push `main`, wait for the GitHub check, and only then ask about `feature/demo-mode`.

## 6. How to brief a ticket subagent

Give each subagent, in this order:

1. The path of its ticket file and of `spec.md` (tell it to read section 0, the decisions table and the glossary first), plus the ticket numbers it depends on and what they already provide.
2. The assigned **migration number** and the instruction not to touch `APPLY_ALL_MIGRATIONS.sql`.
3. The environment rules: local Docker Supabase only, never `web/.env`'s production project; PowerShell syntax; the Grep tool does not work (use Bash `grep`); do not commit (the coordinator commits per ticket with a descriptive message, no co-author trailers); do not touch the parked files in section 1.
4. The test rule: write the ticket's tests first where it is a bug-type ticket (red before fix); run **only** its own spec; the e2e step runs only when the coordinator says the lock is free; also run `cd web; npx tsc --noEmit -p tsconfig.app.json` and lint on changed files.
5. The output format: modified file paths, migration file name, tests run and their result, anything in the ticket it could not do, and any conflict it found with the spec.
6. For tickets 07 and 19 add: prove locally that writing `auth.users` from SQL works before building on it; if the local stack rejects it, stop and report (the fallback is an Edge Function, new infrastructure that needs Tyrone's decision).

After each ticket the coordinator: reviews the diff, runs typecheck, runs the ticket's spec (serially), appends the migration to `APPLY_ALL_MIGRATIONS.sql`, commits on the testing branch, ticks `map.md`, and adds anything new to `TESTING-GUIDE.md`.

## 7. Open items

- **None in the design.** Every question in `spec.md` section 8 is closed; the accepted defaults are listed there.
- **Unanswered, unrelated to this work:** the **"Scheduled Celebrations"** card on the Church Admin dashboard (`ChurchStatsCards.tsx`) still uses the word "Celebrations"; Tyrone has not said whether to rename it (suggestions were "Scheduled Appointments" or "Upcoming Services").
- **Deferred elsewhere** (from the memory notes): system announcements in staff widgets, Facebook followers, global search; the separate client-concerns effort.
- **Known baselines:** nine old legacy migrations fail on every fresh local rebuild (harmless, listed by `scripts/local-db-setup.ps1`); `appointment-cancelled-card.spec.ts` has one intentional `test.fail`.
- **Production state to confirm before ticket 04:** whether the appointment-editing `052` lockdown has reached production (the memory notes say it was pending on 2026-10-22).

## 8. First prompt to paste into the new session

```
Read .scratch/roles-and-account-deletion/HANDOFF.md, then spec.md (section 0 and the decisions table) and map.md. We are implementing the roles, account deletion and tickets work; the design is closed, no code exists yet.

Before coding: check git status and the latest migration number, confirm the plan in HANDOFF section 5 (testing branch from main, migration numbers, wave 1), and show me the migration number assignment.

Then dispatch wave 1 (tickets 01 and 02), one fresh subagent per ticket, briefed as in HANDOFF section 6. Local Docker Supabase only, one e2e run at a time, no production, no commits with co-author trailers. After the wave, report per ticket: files changed, tests run and result, and a short "safe to merge?" note, then wait for me before wave 2.
```
