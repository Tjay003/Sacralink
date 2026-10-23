---
name: release
description: Release main to production (feature/demo-mode): wait rule, migrations, pinned push, Vercel check.
disable-model-invocation: true
---

Release `main` to the production branch `feature/demo-mode`. Typing `/release` is the go-ahead for the push in step 4; a red gate or a missing approval below stops the release. Production Supabase project: `oaczurouvaevebpimply`. The wait rule (which check a release needs) is the table in `docs/agents/test-workflow.md`, "The gate before production".

## 1. Scope the release

`git fetch origin`, then `git diff --stat origin/feature/demo-mode origin/main` and `git log origin/feature/demo-mode..origin/main --oneline`.

Classify it with the wait-rule table: **UI/docs only** or **backend**. When unsure, it is backend.

Done when you can say which of the two it is and name the exact commit that will be released: `git rev-parse origin/main`, called `<sha>` below. Use the full 40-character SHA everywhere: `gh run list --commit` silently matches nothing for a short one.

## 2. Migrations (backend releases)

Compare `supabase/migrations` against `mcp__supabase__list_migrations` for production. For each migration not yet applied:

1. Its local spec in `web/e2e-local` passed.
2. If it changes existing rows, back up the affected tables first into `backups/` (gitignored: the repo is public, never commit data).
3. Apply it with `apply_migration` from this conversation, never from a subagent. The first call may return "Invalid or expired requestState"; retry the identical call.
4. Verify with read-only queries.

Apply additive migrations before the web push, because the new web code assumes them. If a migration blocks something the old live site still does (for example a database guard), say so before pushing and keep the window short.

Done when every migration in the release is applied and verified, or there are none.

## 3. Gate

**UI/docs only:** `gh run list --workflow ci.yml --commit <sha>` is green. If it was cancelled because a newer commit reached `main`, go back to step 1 with that commit.

**Backend:** a green `e2e` run on a commit `<c>` that covers `<sha>`:

1. `gh run list --workflow e2e.yml --branch main --limit 5 --json headSha,status,conclusion` and take the newest run.
2. It covers `<sha>` when `git merge-base --is-ancestor <c> <sha>` succeeds and `git diff --name-only <c> <sha>` lists no file under the `on.push.paths` of `.github/workflows/e2e.yml`. When the release counts as backend only because of roles or permissions in page code (outside those paths), `<c>` must be `<sha>` itself.
3. Still running: wait for it. Nothing covers `<sha>`: `gh workflow run e2e.yml --ref main`, then wait for that run (about 6 minutes).

Done when the required check is green. If it is red, stop and report the failing tests (each of the four shards lists its own).

## 4. Advance production

Fast-forward only, pinned to the commit from step 1, without touching the working folder:

```
git merge-base --is-ancestor origin/feature/demo-mode <sha>   # must succeed
git push origin <sha>:refs/heads/feature/demo-mode
```

Never force-push, never `git checkout`, never `git add -A`: other agents may have uncommitted work in this folder that is not part of the release.

## 5. Verify and report

Wait for Vercel: `gh api repos/Tjay003/Sacralink/commits/<sha>/status` shows the `Vercel` context as `success`. Report what shipped, the migrations applied, the previous production commit (the rollback point), and the state of any job still running. End by pointing Tyrone to `docs/release-smoke-checklist.md` and naming the screen for its step 4. Commit messages carry no co-author trailers.
