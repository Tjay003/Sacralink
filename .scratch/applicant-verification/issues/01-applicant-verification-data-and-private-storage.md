# 01: Applicant verification data, private storage and approval rule

Type: task
Status: done locally 2026-10-24 (migration 078, web/e2e-local/applicant-verification.spec.ts, scripts/purge-applicant-files.mjs). NOT in production: hold until tickets 02 and 03 ship, because approval now needs the applicant part to pass.
**Blocked by:** none

**What to build:** the database side. One additive migration (next free number; run `ls supabase/migrations` first):

- New columns on `parish_applications` for the applicant: `applicant_legal_name`, `applicant_position`, `applicant_phone`, `applicant_id_path`, `applicant_selfie_path`, `applicant_status` (`not_submitted` | `pending` | `passed` | `rejected`, default `not_submitted`), `applicant_rejection_reason`, `applicant_checklist jsonb`, `applicant_reviewed_by`, `applicant_reviewed_at`, `applicant_attempts int default 0`, `applicant_files_delete_after timestamptz`. The existing `status` keeps meaning the parish part.
- A **private** storage bucket `applicant-verification` (not public). Policies: the applicant uploads and reads only their own folder (`<applicant_id>/...`) while the application is open; the Super Admin reads everything; nobody else reads anything (a Church Admin, a Parishioner and another applicant are refused).
- `submit_applicant_verification(p_application_id, ...)`: applicant only, application open, increments `applicant_attempts`, refuses past the attempt limit (decision 3), sets `applicant_status = 'pending'`. Starts with `PERFORM public.assert_account_active();`.
- `review_applicant_verification(p_application_id, p_passed boolean, p_checklist jsonb, p_reason text)`: Super Admin only; a rejection needs a reason of 10+ characters.
- The approval path: the parish approval must refuse unless `applicant_status = 'passed'`. Keep the role change (`set_user_role`, migration 063) inside one function so a half-finished state cannot promote the applicant. Update `approveParishApplication` in `web/src/lib/supabase/parishApplications.ts` to call it.
- Retention: a function `purge_applicant_verification_files()` (service role only) that removes the stored files once `applicant_files_delete_after` has passed, plus a `pg_cron` schedule if the extension is available locally, otherwise documented as a manual job. Set `applicant_files_delete_after` when the application is approved or finally rejected.
- Existing pending applications keep `applicant_status = 'not_submitted'`; existing approved ones are untouched.

- [ ] Only the applicant (own folder) and the Super Admin can read an uploaded ID or selfie; a Church Admin, a Parishioner and another applicant cannot, including through signed URLs.
- [ ] Approving the parish while `applicant_status` is not `passed` is refused with a readable message; once both pass the applicant becomes Church Admin exactly as today.
- [ ] A rejected applicant part records who and why; resubmission works until the attempt limit, then is refused.
- [ ] Files are removed after the retention date; the checklist result and reviewer remain.
- [ ] Nothing about an ID appears in notifications, the activity log or any list query.

**Test plan** (local `applicant-verification.spec.ts`, database rules only; serialize e2e): storage and table access matrix via `clientAs`, the approval refusal, attempts limit, retention function. Four to six tests. Production migration from the main conversation only, after a backup of `parish_applications`.
