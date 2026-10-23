# Spec: Verify the person who applies for a parish

Status: decisions locked 2026-10-24 (Tyrone accepted all defaults). Ticket 01 in progress.

## Problem

A parish application (`parish_applications`, migration 026, UI in `ApplyParishPage.tsx` and `ParishApplicationsPage.tsx`) verifies the **parish** only: parish details plus a Celebret / clergy ID (`celebret_url`) and a Chancery decree (`decree_url`), and the Super Admin checklist (rectory phone call, Celebret validated, merchant name matches). When the Super Admin approves, `approveParishApplication` (`web/src/lib/supabase/parishApplications.ts`) makes the applicant the **Church Admin** of the new church through `set_user_role` (migration 063).

Nobody verifies that the applicant is who they say they are, or that they are entitled to run this parish. Whoever submits the form becomes Church Admin once the parish documents pass.

## Goal

A parish application carries two verifications, reviewed by the Super Admin, and the applicant becomes Church Admin only when **both** pass:

1. **Parish verification** (exists today).
2. **Applicant verification** (new): proof of identity and of the applicant's authority over this parish.

## Proposed behaviour (defaults, change after the decisions below)

- The application form gets an **Applicant** section: full legal name, position in the parish (Parish Priest, Parochial Administrator, Parish Secretary, other), a mobile number, a government-issued photo ID (one image or PDF), and a selfie holding that ID.
- The applicant's own name on the ID must match the name on the Celebret or the decree. This is a checklist item for the Super Admin, not an automatic check.
- ID image and selfie live in a **private** storage bucket. Only the Super Admin can read them, through short-lived signed URLs. They are never public URLs and never appear in lists, notifications or the activity log.
- The Super Admin's review modal gets an **Applicant** checklist next to the parish checklist: ID is valid and unexpired; the face matches the selfie; the name matches the Celebret or decree; the position is plausible for the parish.
- The application has two outcomes the Super Admin can record separately: the parish part and the applicant part. Approving the application requires both to be passed.
- A rejection records which part failed and why. The applicant sees that part's reason and can **resubmit that part only** (see decision 3).
- After approval or final rejection the ID and selfie are deleted on a schedule (decision 2). The checklist result and the reviewer remain.
- Existing Church Admins (approved before this change) are not affected. Pending applications created before this change keep working: their applicant part shows "Not submitted" and the Super Admin can request it.

## Decisions (locked 2026-10-24, all defaults accepted)

1. **Which proof of identity counts, and is the selfie required?** Default: any government-issued photo ID (passport, driver's licence, PhilSys, UMID, postal ID) plus a selfie holding it.
2. **How long are the ID images kept after the decision?** Default: delete 30 days after approval or final rejection. Alternative: delete immediately.
3. **May a rejected applicant resubmit on the same application?** Default: yes, the failed part only, up to 3 times, then they start a new application.

## Out of scope

- Automatic ID or face-matching services.
- Changing the parish verification checklist.
- Re-verifying existing Church Admins.

## Risks

- ID photos are sensitive personal data: storage policies must be tested (a Parishioner, a Church Admin and another applicant must not read them) and the retention job must be verified.
- The repository is public: no ID images, test IDs from real people, or data exports may ever be committed.
- Approval now depends on two states. A race or a half-finished state must not promote the applicant early: the role change stays inside one function that checks both parts.
