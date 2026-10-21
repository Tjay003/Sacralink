# Spec: Tech Debt, React Hook Fixes & Automated Testing

## 1. Problem Statement
1. `web/src/pages/donations/DonationsPage.tsx` violates React's Rules of Hooks by returning early before calling 9 hooks (`useState`, `useChurches`, `useCallback`, `useEffect`), which causes runtime crashes if auth state shifts.
2. `web/src/pages/appointments/AppointmentsPage.tsx` and `BookAppointmentPage.tsx` rely on unsafe `as any` casts rather than the strongly typed `appointments.ts` domain module.
3. Multi-role manual testing (Super Admin, Church Admin, Parishioner) is tedious and lacks an automated E2E test runner (Playwright).

## 2. Scope & Tickets
1. `01-fix-donations-page-hooks-and-types`: Fix conditional hook calls in `DonationsPage.tsx` and enforce domain types.
2. `02-fix-appointments-page-types`: Eliminate `any` casts in `AppointmentsPage.tsx` and `BookAppointmentPage.tsx`.
3. `03-setup-automated-e2e-testing`: Set up Playwright for automated multi-role regression testing across all 3 user personas.
