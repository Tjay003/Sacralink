# Test Workflow

How tests are written, run and gated in this repo. Agreed with Tyrone on 2026-10-22. For the local stack, seeded users and spec-writing helpers, see `docs/agents/local-testing.md`.

## While building: run only your area

Run the spec(s) for the area you touch. It takes seconds.

```
cd web; npx playwright test -c playwright.local.config.ts e2e-local/<file>.spec.ts
```

The full suite is not run after every change, and not locally by default (`cd web; npm run test:e2e:local` exists for when a change is wide enough to need it).

Before any run, stop a stale dev server on port 5174; the config starts its own and will not reuse one.

## What each ticket ships with

Playwright E2E tests are reserved **strictly for high-risk backend logic**:

- Database rules and RLS/permissions: who can read, who can write.
- Schema migrations and transactional state changes.
- Booking and donation/financial logic.

**Zero Playwright tests for UI/Cosmetic tickets:** Components, layout, text wording, color styling, and hover effects must be verified through TypeScript static checks (`tsc -b`) and local dev server checks. Do not write Playwright tests for frontend-only tickets.

**One exception: a flow that crosses from the page into the backend.** A new form that uploads a file, calls a database function or signs someone in gets one short happy-path Playwright test that does the real thing in the browser (fill the form, submit, assert the database row or stored file). Database-rule specs and a screenshot do not catch a broken seam between the page and storage, RLS or an RPC: the parish application form shipped with an upload that failed ("bucket not found") because nothing ever submitted it. Keep it to the happy path, about 15 lines, one per flow.

When a backend bug fix requires a test, write a targeted minimal test that reproduces the defect before fixing it. Do not write E2E tests for minor UI layout or locator glitches.

## The gate before production

Two GitHub Actions workflows run on `main`. Both see committed code only, so a green check says nothing about uncommitted work.

- **`CI`** (`.github/workflows/ci.yml`, about 1 minute): typecheck and production build, on every push.
- **`e2e`** (`.github/workflows/e2e.yml`, about 6 minutes): the full real suite `e2e-local`, split across four runners with a fresh Docker Supabase each. It is the only place the whole suite runs. A push starts it only when it touches the backend paths listed in that file (`supabase/`, `web/src/lib/`, `web/e2e-local/`, the local DB script and config, dependencies), so docs and UI pushes neither start it nor cancel it. It also runs nightly, and by hand with `gh workflow run e2e.yml --ref main`.

What a release waits for depends on what it changes. Both checks are informational; Tyrone decides whether to ship.

| The release touches | Wait for |
| ------------------- | -------- |
| Only UI files (`web/src` pages and components, styling, copy) or docs | `CI` green on the release commit. Do not wait for `e2e`. |
| The database, migrations, roles or permissions, or `web/e2e-local` | `e2e` green on a commit at or after the last backend change. |

When in doubt, treat it as backend. The release itself (scoping, migrations, the push) is the `/release` skill: `.agents/skills/release/SKILL.md`.

## One agent runs e2e at a time

The local Docker Supabase and port 5174 are shared. Parallel agents serialize their test step: start yours only when no other agent's run is in flight.

## Known baseline: leave as is

- Nine old legacy migrations fail on every fresh local rebuild. `scripts/local-db-setup.ps1` lists them; they are harmless.
- `web/e2e-local/appointment-cancelled-card.spec.ts` has one intentional `test.fail`, a known product gap.
