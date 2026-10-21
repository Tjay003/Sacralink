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

Tests for its **risky parts**, plus **one happy-path test** per new screen or flow:

- Database rules and RLS/permissions: who can read, who can write.
- Changes to existing rows, and migrations.
- Notifications.
- Booking or money logic.

Cosmetic, wording and layout checks get no tests. Expect 3 to 8 tests per ticket. A bug fix starts with a test that reproduces the bug, red before the fix.

## The gate before production

Pushing `main` triggers an automatic GitHub Actions check on that commit alone: typecheck, build, and the full real suite `e2e-local`.

- The mocked suite `web/e2e` is **not** part of the gate. 27 of its tests fail on outdated page wording; leave it untouched until Tyrone decides to fix or retire it.
- A red check is informational. Tyrone decides whether to merge `main` into the production branch `feature/demo-mode`.
- Release order: test on `main`, push `main`, then merge into `feature/demo-mode`. Never the reverse.
- The check sees only committed code, so it never exercises Tyrone's uncommitted work. A green check does not prove his working tree works.

## One agent runs e2e at a time

The local Docker Supabase and port 5174 are shared. Parallel agents serialize their test step: start yours only when no other agent's run is in flight.

Production migrations are applied from the main conversation, never from a delegated subagent. Order: the relevant local spec passes, back up first when existing data changes, apply, then verify with read-only queries.

## Known baseline: leave as is

- Nine old legacy migrations fail on every fresh local rebuild. `scripts/local-db-setup.ps1` lists them; they are harmless.
- `web/e2e-local/appointment-cancelled-card.spec.ts` has one intentional `test.fail`, a known product gap.
