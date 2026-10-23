# 03: Super Admin reviews the applicant

Type: task
Status: needs-decisions
**Blocked by:** 01, 02

**What to build:** in `web/src/pages/admin/ParishApplicationsPage.tsx` (the Church Applications queue) add an **Applicant** panel to the review modal, next to the existing parish checklist: the ID and selfie shown through short-lived signed URLs (no permanent link, no download button by default), and an Applicant checklist (ID valid and unexpired; face matches the selfie; name matches the Celebret or decree; position plausible for this parish). Pass or Reject with a reason (10+ characters) calls `review_applicant_verification` from ticket 01.

- The Approve button for the parish stays disabled with a hint until the applicant part has passed. A rejection shows which part failed.
- A pending application from before this change shows the applicant part as "Not submitted" with a **Request applicant details** action that notifies the applicant (existing notification pattern).
- The queue list shows both statuses as two small badges; the list never loads the ID or selfie.

- [ ] The Super Admin sees the ID and selfie only inside the modal, through signed URLs that expire.
- [ ] Parish approval is impossible until the applicant part passes; after both pass the applicant becomes Church Admin as before.
- [ ] A rejection of the applicant part notifies the applicant with the reason and allows resubmission within the limit.
- [ ] A Church Admin or any other role cannot open the panel or the files.

**Test plan:** database rules are covered by ticket 01's spec; the panel itself is checked by typecheck and by hand in the browser (one pass of: submit as applicant, reject the applicant part, resubmit, pass both, approve).
