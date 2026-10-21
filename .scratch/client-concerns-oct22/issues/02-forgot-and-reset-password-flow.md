# 02: Forgot password and reset password flow (`/forgot-password` and `/reset-password`)

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Complete the password recovery flow linked from `"Forgot password?"` on the Login page:

1. **Forgot Password Page (`/forgot-password`)**: A clean, light-mode SacraLink auth page where a user enters their registered email address and submits a password reset request via `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })`, showing a clear confirmation state and a link back to `/login`.
2. **Reset Password Page (`/reset-password`)**: A clean, light-mode SacraLink auth page reached from the recovery email link where the user enters and confirms their new password (enforcing minimum length and matching confirmation), calls `supabase.auth.updateUser({ password })`, and redirects to `/login` (or `/dashboard`) upon success.
3. **Public Routing**: Register `/forgot-password` and `/reset-password` as public routes in the application router so unauthenticated users and users arriving with a recovery token can access them without being redirected away.

- [ ] Clicking `"Forgot password?"` on `/login` navigates to `/forgot-password` and renders the password recovery form instead of a blank or 404 screen.
- [ ] Submitting a valid email on `/forgot-password` invokes `supabase.auth.resetPasswordForEmail` with `redirectTo` pointing to `/reset-password` and displays a confirmation message.
- [ ] Visiting `/reset-password` renders new-password and confirm-password fields with show/hide toggles, validates password match and minimum length, calls `supabase.auth.updateUser({ password })`, and shows a success state with navigation to sign in.
- [ ] E2E test verifies the `/login` -> `/forgot-password` request flow and `/reset-password` validation/submission flow.
- [ ] Typecheck and build stay green.
