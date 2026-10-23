# 02: Applicant section on the parish application form

Type: task
Status: needs-decisions
**Blocked by:** 01

**What to build:** in `web/src/pages/churches/ApplyParishPage.tsx` add an **Applicant** section next to the parish section: full legal name, position in the parish (Parish Priest, Parochial Administrator, Parish Secretary, Other), mobile number, government-issued photo ID upload, and a selfie holding the ID. Uploads go to the private `applicant-verification` bucket from ticket 01 (never a public URL), with image/PDF type and size limits and a clear explanation of who will see the files and when they are deleted.

- The applicant sees the state of **both** parts after submitting (Parish: pending / passed / rejected; Applicant: pending / passed / rejected), and for a rejected part the reason and a **Resubmit** action that touches only that part (until the attempt limit from ticket 01).
- The existing applicant status view (`getMyParishApplications`-style query in `parishApplications.ts`) returns the new fields; add the client helpers and the types in `web/src/types/database.ts`.
- Design: the Sacralink theme (`.card`, tokens in `web/src/index.css`), light mode, phone width without horizontal scroll.

- [ ] An applicant can submit the parish and applicant parts together, and later resubmit only the rejected part.
- [ ] The ID and selfie are never shown in a list or to anyone but the applicant (own preview) and the Super Admin.
- [ ] A user cannot submit an application without the applicant section.

**Test plan:** no new Playwright spec for layout or wording (typecheck and a look at the dev server). The submit and resubmit calls are covered by ticket 01's database spec; do one end-to-end check by hand in the browser.
