# Issue 02: OAuth Callback and Password Reset Deep Link Handlers

Type: task  
Status: resolved  
Blocked by: 01  

## Description
Google OAuth in `AuthContext.tsx` redirects to `sacralink://auth/callback`, and `forgot-password.tsx` redirects to `sacralink://reset-password`. Neither of these routes exists, causing user authentication flows to crash into a 404 Unmatched Route.

## Scope of Work
1. Create `mobile/app/(auth)/callback.tsx`:
   - Parse `#access_token=...&refresh_token=...` or code query params from the incoming URL.
   - Invoke `supabase.auth.setSession({ access_token, refresh_token })`.
   - On success, redirect to the user's role-appropriate home tab via router.
   - Display a clean Vatican Light loading spinner during token exchange.
2. Create `mobile/app/(auth)/reset-password.tsx`:
   - Render a password update form (New Password & Confirm Password).
   - Validate password strength and call `supabase.auth.updateUser({ password })`.
   - On success, redirect to `(auth)/login` with a success toast.
3. Configure `Linking.addEventListener('url', ...)` in `AuthContext.tsx` for cold/warm deep-link handling.

## Acceptance Criteria
- Triggering Google OAuth properly catches the return URL and sets the Supabase session.
- Triggering password reset email links opens the reset password screen instead of an unmatched route.
- `npm run typecheck` passes with 0 errors.

## Resolution
1. **Deep Link Parsing Utility (`mobile/src/lib/authUrl.ts`)**:
   - Implemented `parseAuthUrl` and `handleAuthUrlSession` to extract and process authentication credentials from both fragment hashes (`#access_token=...&refresh_token=...`) and query strings (`?code=...`), as well as error parameters.
2. **OAuth Callback Route (`mobile/app/(auth)/callback.tsx` & `mobile/app/auth/callback.tsx`)**:
   - Created the canonical `(auth)/callback.tsx` screen featuring a clean Sacralink Vatican Light loading screen (`bg-slate-50`, `#2563EB` Faith Blue spinner, parish header).
   - Handles token/code extraction, session establishment via `supabase.auth.setSession` or `supabase.auth.exchangeCodeForSession`, and navigates to the user's role-appropriate tab.
   - Added `mobile/app/auth/callback.tsx` re-exporting the callback screen to handle URLs routing to `/auth/callback` without 404 unmatched route errors.
3. **Password Reset Screen (`mobile/app/(auth)/reset-password.tsx`)**:
   - Built a responsive password reset form with password strength checks (>= 8 chars), match validation, show/hide eye toggles, and session recovery verification.
   - Calls `supabase.auth.updateUser({ password })`, safely invalidates the recovery session, and displays a success confirmation directing the user to sign in.
4. **Forgot Password Screen (`mobile/app/(auth)/forgot-password.tsx`)**:
   - Updated `redirectTo` to dynamically use `Linking.createURL('reset-password')` instead of a hardcoded string.
5. **Auth Context Deep Link Handling (`mobile/src/contexts/AuthContext.tsx`)**:
   - Added `Linking.addEventListener('url', ...)` and `Linking.getInitialURL()` to automatically detect and establish sessions from deep links across warm and cold app starts.
6. **Navigation Guard & Theme Alignment (`mobile/app/_layout.tsx` & `(auth)/_layout.tsx`)**:
   - Registered `callback` and `reset-password` in the `(auth)` stack.
   - Updated `RootNavigation` guard to prevent routing away from `reset-password` or active `callback` processing while an authenticated session is active.
   - Aligned fallback background styles to `#F8FAFC` (`bg-slate-50`).
7. **Verification**:
   - Unit-tested `authUrl` parsing with test fixtures covering implicit grant hash tokens, PKCE codes, recovery hashes, and errors.
   - Static validation: `npm run typecheck` passes with 0 errors.
