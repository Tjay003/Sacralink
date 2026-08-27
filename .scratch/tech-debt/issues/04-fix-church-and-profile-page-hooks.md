# 04 - Fix Church & Profile Pages React Hook Violations & ESLint Cleanup

Status: resolved
Type: task
Blocked by: none

## Description
In `web/src/pages/churches/` and `web/src/pages/profile/`:
1. `AddChurchPage.tsx`:
   - Move the auth role check after all React Hook declarations (`useState`, `useEffect`, etc.).
   - Replace in-render `navigate('/churches')` with declarative `<Navigate to="/churches" replace />`.
2. `EditChurchPage.tsx`:
   - Move the permission check (`canAccess()`) after all React Hook declarations.
   - Replace in-render `navigate('/churches')` with declarative `<Navigate to="/churches" replace />`.
   - Remove unused variables (`_loadingGallery`, etc.) and `as any` casts in church image uploads and state.
3. `ProfilePage.tsx` & `NotificationBell.tsx`:
   - Fix `react-hooks/set-state-in-effect` by refactoring state initialization from profile or guarding effect runs.
   - Fix missing dependency warnings (`user`, `fetchNotifications`).
4. `passwordValidation.ts`:
   - Fix unnecessary escape characters in regular expressions (`\[`, `\/`).

## Acceptance Criteria
- Zero `react-hooks/rules-of-hooks` errors across `AddChurchPage.tsx` and `EditChurchPage.tsx`.
- Zero `react-hooks/set-state-in-effect` errors in `ProfilePage.tsx` and `NotificationBell.tsx`.
- `npx eslint src/pages/churches/ src/pages/profile/ src/components/notifications/ src/utils/passwordValidation.ts` passes with 0 errors.
- `npm run test:e2e` passes all E2E tests.
- `npm run build` succeeds with 0 errors.

## Resolution
- `AddChurchPage.tsx`: Declared all hooks unconditionally at the top of the component, replaced in-render `navigate('/churches')` with `<Navigate to="/churches" replace />` guard, and eliminated `as any` casts in Supabase uploads and inserts.
- `EditChurchPage.tsx`: Moved `canAccess` evaluation and `<Navigate to="/churches" replace />` guard after all hook declarations, removed unused variable `_loadingGallery`, wrapped `fetchGallery` in `useCallback`, and strictly typed `galleryImages` as `Tables<'church_images'>[]` removing all `as any` casts.
- `ProfilePage.tsx`: Eliminated synchronous `setState` in `useEffect` by deriving active form values directly from `profile` state with zero effects.
- `NotificationBell.tsx`: Wrapped `fetchNotifications` in `useCallback`, properly included dependencies in `useEffect`, and eliminated synchronous state updates.
- `passwordValidation.ts`: Removed redundant escape characters `\[` and `\/` in the special characters regex character class.
- All target files pass ESLint with 0 errors and 0 warnings, Playwright 25/25 E2E tests pass, and Vite production build succeeds.
