# Effort Map: Tech Debt & Testing

## Notes
- Feature branch / effort: `tech-debt`
- Tracker mode: Local Markdown (`.scratch/tech-debt/`)

## Tickets

- [x] **01**: [Fix DonationsPage React Hook Violations & Types](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/tech-debt/issues/01-fix-donations-page-hooks-and-types.md) (Blocked by: none)
- [x] **02**: [Eliminate Any Casts in Appointments Pages](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/tech-debt/issues/02-fix-appointments-page-types.md) (Blocked by: none)
- [x] **03**: [Setup Playwright Automated Multi-Role E2E Testing](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/tech-debt/issues/03-setup-automated-e2e-testing.md) (Blocked by: none)
- [x] **04**: [Fix Church & Profile Pages React Hook Violations & ESLint Cleanup](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/tech-debt/issues/04-fix-church-and-profile-page-hooks.md) (Blocked by: none)

## Decisions-so-far
- 2026-08-28: Flagged and cataloged critical React Hook ordering bugs in `DonationsPage.tsx` and type safety gaps across appointments for future implementation.
- 2026-08-28: Resolved Ticket 01 by eliminating conditional hook executions in `DonationsPage.tsx`, removing all `as any` casts in the donations module, and fixing impure render calls. Verified with zero ESLint errors and successful production build.
- 2026-08-28: Resolved Ticket 02 by eliminating all `any` casts in `appointments.ts`, `AppointmentsPage.tsx`, and `BookAppointmentPage.tsx`, defining strict join query interfaces, fixing prefer-const for `channelConfig` and `endPage`, and strictly typing document requirement uploaders. Verified with ESLint 0 errors and production build success.
- 2026-08-28: Resolved Ticket 03 by configuring Playwright E2E testing framework in `web/` with 4 test suites (`auth.spec.ts`, `navigation.spec.ts`, `roles.spec.ts`, `announcements.spec.ts`) covering Super Admin, Church Admin, and Parishioner personas. Added `"test:e2e": "playwright test"` script. Verified with 25/25 passing tests in ~7.6 seconds and clean production build.
- 2026-08-28: Resolved Ticket 04 by fixing React Hook rules violations in `AddChurchPage.tsx` and `EditChurchPage.tsx` with top-level declarations and `<Navigate>` guards, removing `as any` casts and unused variables in church management, refactoring `ProfilePage.tsx` and `NotificationBell.tsx` to eliminate setState-in-effect and missing deps, and removing useless regex escapes in `passwordValidation.ts`. Verified with 0 ESLint errors across target paths, 25/25 passing E2E tests, and 0-error production build.
