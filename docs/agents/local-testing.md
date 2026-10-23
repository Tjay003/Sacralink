# Local Backend Testing

Anything that touches the backend (database functions, RLS, notifications, auth roles, migrations) is tested against a **local Supabase stack running in Docker**, with real Playwright end-to-end tests. `web/.env` points at the **production** Supabase project: never test backend changes against it.

## Why

Only a real database can prove that a database function writes its history row, that notifications fan out, or that RLS blocks direct updates (see `docs/adr/0001-appointment-edits-via-database-functions.md`). An older mocked suite that stubbed `rpc/*` and the REST routes could not, and was deleted on 2026-10-24.

When and what to run is in `docs/agents/test-workflow.md`; this file covers the stack itself.

## Prerequisites

- Docker Desktop running.
- Node 20+. The Supabase CLI is used through `npx supabase`; no global install needed.

## Commands

Run from the repo root unless noted.

| Goal | Command |
| ---- | ------- |
| Start the local stack | `npx supabase start` |
| Stop it | `npx supabase stop` |
| Apply / rebuild the schema | `powershell -File scripts/local-db-setup.ps1 -Reset` |
| Run one spec | `cd web; npx playwright test -c playwright.local.config.ts e2e-local/<file>.spec.ts` |
| Run the full real suite | `cd web; npm run test:e2e:local` |
| Run the app by hand against the local DB | `cd web; npx vite --mode e2e --port 5174` |

Studio is at http://127.0.0.1:54323 and the mail inbox at http://127.0.0.1:54324 while the stack is running.

## How it is wired

- `supabase/config.toml`: local stack config. The CLI's own migration replay is **disabled** because the legacy migrations were written for the SQL editor (a drop-all script, duplicate version numbers such as `003_`, `009_`, `052_`) and cannot replay on an empty database.
- `scripts/local-db-setup.ps1`: applies `supabase/migrations/*.sql` in filename order. A few old superseded migrations fail on a fresh database (storage-policy ownership, an older `user_role = text` comparison, duplicated policies); none touch appointments, and the script lists them.
- `web/.env.e2e`: points the app at `http://127.0.0.1:54321` with the public local demo keys. Loaded only by `vite --mode e2e`.
- `web/playwright.local.config.ts`: starts its own Vite server on port 5174 (`reuseExistingServer: false`) so it can never reuse a dev server pointed at production.
- `web/e2e-local/global-setup.ts`: idempotently seeds two parishes and one user per role. `support.ts` refuses to run if the Supabase URL is not local.

## Seeded users

All use the password `LocalTest#123`.

| Role | Email |
| ---- | ----- |
| Church admin (Local Test Parish) | `admin@local.test` |
| Priest | `priest@local.test` |
| Second priest | `priest2@local.test` |
| Parishioner | `parishioner@local.test` |
| Church admin (Other Test Parish) | `other-admin@local.test` |

## Writing a local spec

- Log in through the real login form (`loginAs`) and assert on database state with the service-role client (`serviceClient`). Use `clientAs(role)` for calls that must be subject to RLS.
- Reset state in `beforeEach` (`resetAppointmentData`) and create data with helpers such as `createApprovedAppointment`.
- Seed data must satisfy the schema's check constraints: `churches.status` is one of `active`, `inactive`, `unverified`, `verified_active`; `appointments.service_type` is capitalised (`Baptism`, `Wedding`, `Funeral`, `Confirmation`, `Blessing`, `Other`).
- Prefer scripted Playwright over a Playwright MCP: a passing run costs a few lines of output. For one-off visual checks, save a `page.screenshot()` and open the PNG.
