# 02 - Eliminate Any Casts in Appointments Pages

Status: resolved
Type: task
Blocked by: none

## Description
In `web/src/pages/appointments/AppointmentsPage.tsx` and `web/src/pages/appointments/BookAppointmentPage.tsx`:
1. Use `HydratedAppointment` and typed helpers from `web/src/lib/supabase/appointments.ts`.
2. Eliminate all `(data as any)` and `(appt as any)` casts.
3. Fix the `const` reassignment lint error on `endPage` in `AppointmentsPage.tsx`.

## Acceptance Criteria
- Full TypeScript typing with zero `as any` casts.
- `npx eslint src/pages/appointments/` passes with 0 errors.

## Resolution
- `web/src/lib/supabase/appointments.ts`: Removed all `any` / `as any` casts, typed Supabase joined query results and errors with `RawAppointmentQueryResult`, `DatabaseAppointment`, `PostgrestError | Error | null`, and configured `RealtimePostgresChangesFilter<'*'>` with `const channelConfig`.
- `web/src/pages/appointments/AppointmentsPage.tsx`: Replaced `(app as any).church_id` with typed `app.church_id`, eliminated all `any` error casts, and fixed `endPage` to `const`.
- `web/src/pages/appointments/BookAppointmentPage.tsx`: Replaced `(reqs as any)` with typed `SacramentRequirement[]`, cleaned up error handling without `any`, and enforced strict boolean typing on `DocumentUploader`.
- Static validation verified: `npx eslint src/pages/appointments/ src/lib/supabase/appointments.ts` passes with 0 errors and `npm run build` succeeds with 0 errors.
