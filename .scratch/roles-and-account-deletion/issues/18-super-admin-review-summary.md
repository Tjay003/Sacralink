# 18: Super Admin review summary on a deletion request

Type: task
Status: ready-for-agent
**Blocked by:** 17, 19

**What to build:** Give the Super Admin evidence before they decide, so a deletion is never based on the Church Admin's word alone (the client's concern: "he did something unpleasant", "not active anymore"). The summary appears on a deletion-request ticket, and on a Report a person or abuse ticket that names a person (ticket 17), for the Super Admin only. It uses data we already have; **no new logging is added**.

What we really have (checked in `supabase/foundation/schema.sql` and `001_initial_schema.sql`): the profile (role, church, `created_at`), `auth.users.last_sign_in_at`, rows the user created (`appointments.user_id`, `donations.user_id`, `messages.sender_id`, `conversations.created_by`), and `activity_logs (user_id, church_id, action, entity_type, entity_id, metadata, created_at)`, which is **sparsely written today** (`AssignStaffModal.tsx`, `ChurchDetailPage.tsx`, the role/transfer functions). Recent activity will therefore often be short; the panel must say so honestly instead of looking broken.

Migration (next free number; append to `APPLY_ALL_MIGRATIONS.sql`):
- `public.get_user_review_summary(p_user_id uuid) RETURNS jsonb` (`SECURITY DEFINER`, fixed `search_path`, `STABLE`, `REVOKE ... FROM PUBLIC`, `GRANT EXECUTE` to `authenticated`; **raises unless the caller is the `super_admin`**). Returns: `full_name`, `email`, `role`, `is_priest`, church id and name, `created_at` (joined), `last_sign_in_at` read from `auth.users` (this is why it must be `SECURITY DEFINER` and Super Admin-only; clients cannot read `auth.users`), `suspended_at` and `deleted_at` (the columns added by tickets 19 and 07), counts (`appointments`, `donations`, `messages_sent`, `tickets_raised`, plus `appointments_cancelled` and `donations_rejected` if the status columns make that cheap), and the last 10 `activity_logs` rows where `user_id = p_user_id` (action, entity type, created_at). Never returns message text or donation amounts or proof URLs.

Web: a **Review** panel on the ticket info side for a deletion request (`MessagingPage.tsx` info column, next to "TICKET INFORMATION"), visible only to the Super Admin, when `category = 'user_deletion_request'` or a `report_person` ticket names a subject user (`subject_user_id`): person card (name through `UserName` once ticket 08 exists, role, church, joined, last sign-in as a relative date plus exact tooltip), the counts, the activity list ("No recorded activity yet" when empty, with a line that activity recording is limited), and links to the user's row on `UsersPage` (a `?user=<id>` focus parameter) and to the church. When the subject is already deleted or suspended, show that state prominently and disable the summary's stale numbers behind a note. Add `getUserReviewSummary(userId)` in `web/src/lib/supabase/profiles.ts` and update `web/src/types/database.ts`.

- [ ] The Super Admin sees reason, role, church, joined date, last sign-in, the four counts and up to 10 recent activities on a deletion request. The same panel appears on a Report a person or abuse ticket that names a subject, and on no other category.
- [ ] Any other role calling `get_user_review_summary` is rejected, including the Church Admin who filed the request.
- [ ] A user with no activity shows a clear empty state; a user who never signed in shows "Never signed in".
- [ ] No message content, amounts or file URLs are exposed.

**Test plan** (local `review-summary.spec.ts`): create a parishioner with an appointment, a donation, a message and an `activity_logs` row; call the function as the Super Admin and assert the numbers and the 10-row cap; call it as Church Admin, Priest and the user themselves and assert rejection; one UI check that the panel renders for the Super Admin on a deletion request and not for the requesting Church Admin. Four tests. Serialize e2e.
