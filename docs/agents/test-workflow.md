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

Pushing `main` triggers an automatic GitHub Actions run on that commit alone, in two jobs (`.github/workflows/ci.yml`):

- **`quick`** (about 1 minute): typecheck and production build. This is the only job to wait for after a push.
- **`e2e`** (about 10 to 15 minutes): the full real suite `e2e-local` on a fresh Docker Supabase. It starts after `quick` passes and nothing waits on it while building. It is the only place the whole suite runs, and it sees committed code only.

- The mocked suite `web/e2e` is **not** part of the gate. 27 of its tests fail on outdated page wording; leave it untouched until Tyrone decides to fix or retire it.
- Both checks are informational. Before asking Tyrone about merging into the production branch `feature/demo-mode`, confirm `e2e` is green on the exact commit being released (`gh run list --branch main`); if it is still running, say so instead of waiting silently. Tyrone decides whether to merge.
- Release order: test on `main`, push `main`, then merge into `feature/demo-mode`. Never the reverse.
- The check sees only committed code, so it never exercises Tyrone's uncommitted work. A green check does not prove his working tree works.

## One agent runs e2e at a time

The local Docker Supabase and port 5174 are shared. Parallel agents serialize their test step: start yours only when no other agent's run is in flight.

Production migrations are applied from the main conversation, never from a delegated subagent. Order: the relevant local spec passes, back up first when existing data changes, apply, then verify with read-only queries.

## Known baseline: leave as is

- Nine old legacy migrations fail on every fresh local rebuild. `scripts/local-db-setup.ps1` lists them; they are harmless.
- `web/e2e-local/appointment-cancelled-card.spec.ts` has one intentional `test.fail`, a known product gap.
