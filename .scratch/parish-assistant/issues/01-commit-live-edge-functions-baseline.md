# 01: Commit the live edge functions as a baseline

Type: task
**Status:** resolved
**Blocked by:** None (can start immediately)

**What to build:** the live `church-ai-chat` (v11) and `sync-church-knowledge` (v12) edge functions existed only on the production Supabase project and had never been in git. Save their current source unchanged in the repo so the Parish Assistant work starts from a tracked baseline that the local stack can serve, with the local config mirroring production's JWT setting.

- [x] Both functions' source is in the repo, unchanged from production
- [x] The local Supabase config mirrors production's `verify_jwt = false` for both
- [x] Committed on `feature/parish-assistant`

## Resolution

Commit `597c54d` on `feature/parish-assistant` (2026-10-24). The source was copied from the production function contents. Supabase exposes no checksum comparable with a plain file, so byte-for-byte identity could not be proven; any drift would show up as a diff on first edit. The one-off `test-gemini-api` function was deliberately left out.
