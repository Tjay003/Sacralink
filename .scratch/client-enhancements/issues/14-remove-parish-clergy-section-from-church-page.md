# Issue 14: Remove the Parish Clergy Section from the Church Page

Type: feature
Status: resolved
Blocked by: 

---

## 1. Description
Tyrone reviewed ticket 04's public "Parish Clergy" cards on the church page and does not want them there. Priests are surfaced at booking instead (ticket 15). This ticket removes the roster UI and everything that existed only to support it.

### Remove
- The `ParishClergySection` component and its use in `web/src/pages/churches/ChurchDetailPage.tsx`, including the "Book with Father" button.
- The header priest line and the quick-facts "Parish clergy" row that ticket 04 rewired to the roster (`parishPriestSummary`). Restore them to their behavior before ticket 04 (commit `bc1e305^`), but do NOT bring back the invented "Rev. Fr. Assigned Clergy" placeholder name: when no priest is known, hide the line.
- The Governance "Pastor of record" sub-line: restore the pre-04 behavior, with the demo fallback unchanged.
- `web/e2e-local/church-clergy-roster.spec.ts`: delete the UI cases; keep (move into `celebrant-eligibility.spec.ts` if not already covered there) the anon-key `get_parish_clergy` RPC assertions that prove no reason, email or phone is returned.

### Keep (do not touch)
- `get_parish_clergy` RPC and migration 054. Ticket 15 uses it for the booking priest select.
- `useParishClergy` hook and `celebrantLabel`. Tickets 03 and 15 use them.
- The Celebrant badge on Mass schedule cards, the "Presiding priest" select in the Add/Edit schedule modals, and the livestream standby celebrant (ticket 03).

---

## 2. Acceptance Criteria
- [x] The church page shows no Parish Clergy section and no "Book with Father" button for any parish.
- [x] Header, quick facts and "Pastor of record" no longer read from the clergy RPC and never show an invented priest name.
- [x] Ticket 03 features (Mass card badge, schedule modal select, livestream standby) still work.
- [x] Full `web/e2e-local` suite passes; `tsc -b` is clean.

---

## Resolution
Done on `main` (web only, local only, no migration).

- `ChurchDetailPage.tsx`: removed the `ParishClergySection` use (and its "Book with Father" button) and every read of the roster for names. The header line, the quick-facts row and the Governance "Pastor of record" sub-line are back to the pre-04 `staffList` priest lookup. The header line and the quick-facts "Parish priest" row are hidden when no priest is known; the invented "Rev. Fr. Assigned Clergy" name is gone and the Governance demo fallback ("Fr. Anselmo Dizon") is unchanged. The `useParishClergy` call stays only as `byId` for the Mass card Celebrant badge (ticket 03).
- Deleted `web/src/components/churches/ParishClergySection.tsx` and `web/e2e-local/church-clergy-roster.spec.ts`. Its anon RPC cases (no reason, email or phone; statuses; empty parish; admin flagged `is_priest`) were already covered in `celebrant-eligibility.spec.ts`, so nothing needed moving.
- `useParishClergy.ts`: removed `parishPriestSummary` (nothing used it any more). `celebrantLabel` and the hook stay.
- Kept untouched: `get_parish_clergy`, migration 054, ticket 03 features.
- New test in `web/e2e-local/presiding-priest.spec.ts`: on Local Test Parish (2 priests) the church page has no "Parish Clergy" heading, no clergy section, no "Book with Father" button and no "Assigned Clergy" text.
- Verification: full `web/e2e-local` suite 105/105 (118 minus the 14 removed roster cases, plus 1 new); `tsc -b` clean; eslint on touched files has no errors (one pre-existing `react-hooks/exhaustive-deps` warning for `fetchGallery` in `ChurchDetailPage.tsx`, not part of this change). A stale local e2e Vite server held port 5174, so the suite was run through a temporary copy of the local config with `reuseExistingServer: true` (that server runs `--mode e2e` against the local Supabase).
