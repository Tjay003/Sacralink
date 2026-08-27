# 02 - Eliminate Any Casts in Appointments Pages

Status: ready-for-agent
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
