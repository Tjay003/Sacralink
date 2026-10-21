# Issue 06: Services & Documents Manager and Funeral Default

Type: feature
Status: resolved
Blocked by: 16

---

## 1. Description
Church admins need one place, inside **Edit Church**, to manage the services their parish offers and the documents a parishioner must upload for each. This ticket reworks the original "customizable requirements" proposal around the church-owned service types from ticket 16.

Settled in grilling with Tyrone (2026-10-21):
1. **Location:** a "Services & Documents" section in `web/src/pages/churches/EditChurchPage.tsx` (new component `web/src/components/churches/ServicesAndDocumentsManager.tsx`). Not a separate dashboard screen.
2. **Who:** that parish's church admin plus admin and super admin. The section is hidden for everyone else; RLS from ticket 16 is the real guard.
3. **Services (from ticket 16):** add, rename, edit the optional description, reorder, hide/unhide, delete (soft, per ticket 16). Show a clear confirmation when deleting a service that has appointments ("Existing appointments keep this service; it will no longer be offered."). Deleted services are not listed. Names must be unique per parish (case-insensitive), with an inline error.
4. **Documents per service:** each service lists its checklist inline. The admin can add a document (name, optional description, Required/Optional toggle), edit its name, description or required flag, delete it, and reorder. Reuse `createRequirement`, `updateRequirement`, `deleteRequirement` in `web/src/lib/supabase/requirements.ts`, extended to write `service_type_id`. Allowed file types keep the table default.
5. **Funeral default:** the starter template gives **Funeral** a required `Death Certificate`. `seedDefaultRequirements` includes it for new parishes (and parish applications), and a one-time migration adds it to **existing parishes whose Funeral service has no checklist yet**. Parishes that already set their own Funeral checklist are untouched. It is an ordinary editable/deletable document afterwards.
6. **Booking enforcement:** `BookAppointmentPage.tsx` renders exactly the saved checklist for the chosen service and blocks submission until required documents are uploaded (verify the existing behavior still holds with ids; ticket 16 rewires the lookup). A service with no documents shows no upload section.
7. **Light design system** (AGENTS.md): `.card` containers, Faith Blue actions, no dark-only classes; fully responsive with no overlap at 375px.
8. **Web only.** Mobile untouched.

### Files involved
- `web/src/pages/churches/EditChurchPage.tsx`
- `web/src/components/churches/ServicesAndDocumentsManager.tsx` (new)
- `web/src/lib/supabase/requirements.ts`, `web/src/lib/supabase/serviceTypes.ts` (from 16)
- `web/src/pages/appointments/BookAppointmentPage.tsx`
- `web/src/pages/churches/AddChurchPage.tsx`, `web/src/lib/supabase/parishApplications.ts` (seeding)
- one small migration for the Funeral backfill

---

## 2. Acceptance Criteria
- [x] Church admin can add, rename, describe, reorder, hide and delete services in Edit Church.
- [x] Church admin can add, edit, reorder and delete documents per service, with Required/Optional.
- [x] New parishes get the six services with their checklists, including Funeral's Death Certificate; existing parishes without a Funeral checklist get it once via migration.
- [x] Booking shows the parish's customized checklist and enforces required uploads.
- [x] Other roles cannot see or use the section; RLS blocks their writes.
- [x] Local e2e covers the manager end to end plus booking with a custom service and checklist.
- [x] Builds and passes TypeScript validation cleanly (`tsc -b`).
- [x] Migration applied and verified on production.

Production: migration 057 applied on 2026-10-22 (project `oaczurouvaevebpimply`). It is additive plus one constraint change, so no data snapshot beyond the before-counts was needed. Verified read-only: sacrament_requirements 57 to 61 (the 4 new Death Certificates for Sacred Heart of Jesus Parish, Our Lady of Perpetual Help Quasi-Parish, St. Joseph the Worker Parish and Quasi-Parish of Our Lady of La Salette; the fifth parish already had its own Funeral checklist and was untouched); 65 uploaded appointment_documents and 48 appointments unchanged; every Funeral service now has a checklist; no unlinked requirements; `anon` and `authenticated` cannot run the backfill function. IMPORTANT finding: production's `appointment_documents.requirement_id` foreign key was ON DELETE CASCADE (not the SET NULL that migration 009 describes), so deleting a checklist item would have deleted the parishioners' uploaded files. 057 changed it to ON DELETE SET NULL, which the new manager needs.

## Resolution

Built and verified on the local Docker Supabase only (full suite 170 tests, 170 passed; 154 before plus 16 new). Production is untouched: migration 057 has not been applied to it. The web code is on `main` only.

### Design as built
- **`web/src/components/churches/ServicesAndDocumentsManager.tsx`** (new), rendered as card 7 in the left column of `EditChurchPage` for `church_admin`, `admin` and `super_admin` only (the parish priest can open Edit Church but never gets the section; RLS from ticket 16 is the real guard). Every change saves right away, not with the page's "Save changes" (the card says so). The mini forms never submit the surrounding page form (Enter saves the open mini form).
  - **Services**: one card row per live service (hidden ones included, deleted ones not) with icon buttons Move up / Move down, Hide / Show, Edit (name and optional description in one inline form), Delete; a "Hidden" badge; "Add service" at the top (new services go to the end). A duplicate name (any case, surrounding spaces ignored; Postgres unique violation 23505) shows an inline error and keeps the form open. Delete asks first in an inline confirmation: a count of the service's appointments picks the wording ("Existing appointments keep this service; it will no longer be offered." when there are any, otherwise "... removed permanently together with its documents"); the actual soft-vs-hard decision stays in `delete_church_service_type()`.
  - **Documents**: each service has a "Documents (n)" disclosure with its checklist: name, optional description, Required / Optional badge, Move up / down, Edit, Delete (inline confirmation), and "Add document" (name, description, Required / Optional segmented control). Writes go through `createRequirement` / `updateRequirement` / `deleteRequirement` and always set `service_type_id` (the lowercased service name goes in the legacy text column, ticket 16's trigger keeps it right). Allowed file types keep the table default.
  - Reordering rewrites `display_order` as 1..n for the rows that moved. At 375px it is a single column, buttons wrap inside the row, no horizontal scroll (e2e checked, screenshot reviewed).
- **`requirements.ts`**: `getRequirementsForChurch(churchId)` (one query for the manager); the starter checklists now include Funeral = required "Death Certificate", so `seedDefaultRequirements` (Add Church and parish applications) gives new parishes the six services with their checklists including it. Parish applications and Add Church already called the seeder, so nothing changed there.
- **Booking**: `BookAppointmentPage` already read the checklist by id and blocked submission on missing required documents (verified, logic unchanged). New: the document description written by the office is shown under each document on the booking form (`DocumentUploader` got an optional `description`). A service with no documents shows no upload section.
- **Migration `supabase/migrations/057_funeral_default_requirement.sql`** (next free number; appended to `APPLY_ALL_MIGRATIONS.sql`). ASCII only, `BEGIN`/`COMMIT`, additive:
  1. `backfill_funeral_death_certificate()` (SECURITY DEFINER, service_role only) inserts a required "Death Certificate" (display_order 1, legacy text = lowercased service name) for each live service of kind `funeral` (whatever it is called now) that has no `sacrament_requirements` rows at all. Parishes with their own Funeral checklist (even optional-only) are untouched, documents only on other services do not count, and parishes that deleted Funeral are skipped. The migration calls it only the first time it is applied (it records whether the function already existed), so re-running the file or `APPLY_ALL_MIGRATIONS.sql` never resurrects a Death Certificate a parish deleted on purpose; calling the function directly is still idempotent (second call adds 0).
  2. Addition beyond the written scope, needed for "delete documents": `appointment_documents.requirement_id` referenced `sacrament_requirements` with no ON DELETE action, so a checklist document a parishioner had already uploaded a file for could never be deleted (FK violation 23503, found while testing). The FK becomes `ON DELETE SET NULL` (column already nullable, idempotent, found by columns, no row changes). Uploaded files stay on their appointment; the viewers already fall back to the label "Document". The verify SQL checks the FK and nullability.
- **Verification SQL (read-only)**: `supabase/verify/057_funeral_default_before.sql` (run BEFORE applying: totals, how many parishes will get the Death Certificate and which, how many keep their own checklist, current FK and column nullability) and `supabase/verify/057_funeral_default_verify.sql` (run AFTER: one result set with an `ok` column: no live Funeral service without a checklist row, no duplicate Death Certificate, no null service links, FK is ON DELETE SET NULL, column nullable, function present and not callable by anon / authenticated, plus totals to compare with the before snapshot: requirements_total = before + parishes counted, appointment_documents_total identical).
- No schema or type change, so `web/src/types/database.ts` was not touched.

### Tests
- New `web/e2e-local/services-documents-manager.spec.ts` (16 tests, written first and seen failing, then passing): services (list in order and add custom with description; rename follows appointments, edit and clear description; duplicate name inline on add and rename, case/space-insensitive; reorder up/down persisted and is the booking order; hide/show reflected on the booking form; delete unused with confirmation removes it; delete with appointments warns, keeps history, frees the name); documents (add / edit name, description, Required flag / reorder / delete with confirmation; survive a service rename; a document already uploaded against can be deleted); Funeral default (a parish created through the real Add Church form gets the six services and a required Death Certificate; the backfill rule on four fabricated parishes, idempotent second run, service_role only); who can use it (church admin, admin, super admin see it; priest, parishioner and the other parish's admin do not; RLS blocks priest, parishioner, other-parish admin and volunteer writes to services and documents); booking (custom service plus custom checklist built through the manager, exact checklist and descriptions shown, no upload section for a service without documents, a required document blocks submission until uploaded, the upload requests carry exactly the checklist ids; flipping a document to Optional lets the booking through); layout at 375px.
- Local booking uploads use a mocked storage object and `appointment_documents` POST (the local database has neither the `appointment-documents` bucket nor policies on that table); the appointment itself is real.
- Full local suite: 170 tests, 170 passed (previously 154). `tsc -b` clean; eslint clean on every touched file (two pre-existing errors in files I edited were fixed: an unused `_requirementId` in `DocumentUploader` and an `any` cast in `EditChurchPage`).
- Migration rehearsal on the local database: applied once (backfilled); deleting a Death Certificate and re-running the file left it deleted ("already applied"); the verify SQL returned every `ok` true except check 2 after that deliberate deletion (expected, noted in the file header).

### Deviations
- Added the FK change above (not in the ticket text). If production should stay untouched there, drop that section of the migration; deleting a document that has uploads then fails with a raw FK error.
- The pre-existing "Skip for Testing" checkbox on the booking form still bypasses the required-document check (out of scope, flagged).
- Deleting a document is confirmed inline (not in the ticket).
