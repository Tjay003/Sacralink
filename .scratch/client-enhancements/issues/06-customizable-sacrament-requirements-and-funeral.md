# Issue 06: Services & Documents Manager and Funeral Default

Type: feature
Status: ready-for-agent
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
- [ ] Church admin can add, rename, describe, reorder, hide and delete services in Edit Church.
- [ ] Church admin can add, edit, reorder and delete documents per service, with Required/Optional.
- [ ] New parishes get the six services with their checklists, including Funeral's Death Certificate; existing parishes without a Funeral checklist get it once via migration.
- [ ] Booking shows the parish's customized checklist and enforces required uploads.
- [ ] Other roles cannot see or use the section; RLS blocks their writes.
- [ ] Local e2e covers the manager end to end plus booking with a custom service and checklist.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`); migration applied and verified on production after a backup.
