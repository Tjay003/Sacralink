# Mocked UI suite: on standby

These specs run the app against **faked backend responses** (`rpc/*` and the REST routes are stubbed), so they need no database. They only prove the page sends the right request.

**Status: not in use.** Kept on purpose until Tyrone decides to fix or retire them (see `docs/agents/test-workflow.md`).

- Not part of the GitHub check on `main` and not part of the gate before production.
- About 27 tests fail because page wording changed since they were written. A red run here does not mean the app is broken.
- They cannot catch a broken seam between the page and storage, RLS or an RPC. Use the real suite for that: `web/e2e-local` (see `docs/agents/local-testing.md`).

Run only if you really want them: `cd web; npm run test:e2e`.
