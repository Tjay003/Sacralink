---
name: release
description: Release main to production (feature/demo-mode): wait rule, migrations, pinned push, Vercel check.
disable-model-invocation: true
---

Release `main` to the production branch `feature/demo-mode`. Typing `/release` is the go-ahead for the push in step 4; a red gate or a missing approval below stops the release. Production Supabase project: `oaczurouvaevebpimply`. Read `docs/agents/test-workflow.md` ("The gate before production") for the CI jobs.

## 1. Scope the release

`git fetch origin`, then `git diff --stat origin/feature/demo-mode origin/main` and `git log origin/feature/demo-mode..origin/main --oneline`.

Classify it. **UI/docs only**: `web/src` pages, components, styling, copy, docs, scripts that only matter locally. **Backend**: anything in `supabase/`, `web/src/lib/supabase`, roles or permissions, `web/e2e-local`. When unsure, it is backend.

Done when you can say which of the two it is and name the exact commit (`origin/main`) that will be released.

## 2. Migrations (backend releases)

Compare `supabase/migrations` against `mcp__supabase__list_migrations` for production. For each migration not yet applied:

1. Its local spec in `web/e2e-local` passed.
2. If it changes existing rows, back up the affected tables first into `backups/` (gitignored: the repo is public, never commit data).
3. Apply it with `apply_migration` from this conversation, never from a subagent. The first call may return "Invalid or expired requestState"; retry the identical call.
4. Verify with read-only queries.

Apply additive migrations before the web push, because the new web code assumes them. If a migration blocks something the old live site still does (for example a database guard), say so before pushing and keep the window short.

Done when every migration in the release is applied and verified, or there are none.

## 3. Gate

Find the run for the exact commit: `gh run list --commit <sha>`.

- **UI/docs only**: the `quick` job (typecheck and build) is green. Do not wait for `e2e`; say it is still running and report its result when it finishes.
- **Backend**: the `e2e` job (full suite) is green on that exact commit.

A push to `main` cancels the run in flight, so do not push to `main` while waiting. If the run was cancelled, find the newest commit's run instead and release that commit.

Done when the required job is green for the commit being released. If it is red, stop and report the failing tests.

## 4. Advance production

Fast-forward only, pinned to the commit from step 1, without touching the working folder:

```
git merge-base --is-ancestor origin/feature/demo-mode <sha>   # must succeed
git push origin <sha>:refs/heads/feature/demo-mode
```

Never force-push, never `git checkout`, never `git add -A`: other agents may have uncommitted work in this folder that is not part of the release.

## 5. Verify and report

Wait for Vercel: `gh api repos/Tjay003/Sacralink/commits/<sha>/status` shows the `Vercel` context as `success`. Report what shipped, the migrations applied, and the state of any job still running. Commit messages carry no co-author trailers.
