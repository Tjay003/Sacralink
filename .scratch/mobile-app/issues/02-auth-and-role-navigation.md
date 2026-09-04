# Issue 02: Mobile Authentication & Dynamic Role-Adaptive Navigation

Type: task  
Status: resolved  
Blocked by: 01  

---

## 1. Description
Build the complete mobile authentication flow (Login, Register, Forgot Password, Google OAuth) with session persistence and implement the dynamic role-adaptive bottom tab navigation for `user`, `priest`, `church_admin`, and `super_admin`.

---

## 2. Acceptance Criteria
- [x] Mobile `AuthContext.tsx` with `signIn`, `signUp`, `signInWithGoogle`, `resendConfirmationEmail`, `signOut`, and `refreshProfile`.
- [x] Login screen (`app/(auth)/login.tsx`) with email/password validation and "Invalid email or password" vs "Email not confirmed" error handling.
- [x] "Resend Confirmation Email" action on unconfirmed email errors.
- [x] Register screen (`app/(auth)/register.tsx`) with password strength indicator.
- [x] Role-adaptive root navigator (`app/(tabs)/_layout.tsx`):
  - `user`: Tabs for *Explore*, *Appointments*, *Donations*, *Announcements*, *Profile*.
  - `priest`: Tabs for *Schedule*, *Consultations*, *Messages*, *Profile*.
  - `church_admin` / `admin`: Tabs for *Parish Hub*, *Appointments Queue*, *Donations Queue*, *Messages*, *Profile*.
  - `super_admin`: Tabs for *Metrics*, *Parish Applications*, *Users*, *Announcements*, *Profile*.

---

## 3. Implementation Steps
1. Create `mobile/src/contexts/AuthContext.tsx`.
2. Build `app/(auth)/login.tsx` and `app/(auth)/register.tsx`.
3. Create role-specific tab groups under `app/(tabs)/`.
4. Add route guards redirecting unauthenticated users to `(auth)/login`.

---

## 4. Resolution
- Built `mobile/src/contexts/AuthContext.tsx` managing `user`, `profile`, `session`, and `loading` states with `signIn`, `signUp`, `signInWithGoogle`, `resendConfirmationEmail`, `signOut`, and `refreshProfile`. Exported role hooks: `useAuth`, `useIsAdmin`, `useIsSuperAdmin`, `useIsPriest`, `useIsChurchAdmin`.
- Built `mobile/app/(auth)/_layout.tsx` with hidden header stack navigation.
- Built `mobile/app/(auth)/login.tsx` featuring email/password validation, detection of unconfirmed emails with an amber banner and one-click resend confirmation trigger, password visibility toggle, and Google OAuth action.
- Built `mobile/app/(auth)/register.tsx` featuring full name, email, password match validation, dynamic 5-criteria password strength meter (red/amber/emerald bar and chips), and confirmation email success card.
- Built `mobile/app/(auth)/forgot-password.tsx` with password reset link trigger and confirmation card.
- Implemented `mobile/app/(tabs)/_layout.tsx` with dynamic role-adaptive bottom tab navigation for `user`, `priest`, `admin` / `church_admin`, and `super_admin`.
- Built `mobile/app/(tabs)/index.tsx` routing automatically to the role's default tab.
- Built 13 domain screen stubs for all tab routes:
  - `explore/index.tsx` (Parishioner Directory & Map)
  - `appointments/index.tsx` (Parishioner Sacrament Bookings)
  - `donations/index.tsx` (Parishioner Cashless Stewardship)
  - `announcements/index.tsx` (Parish & Diocesan Bulletins)
  - `priest/index.tsx` (Liturgical Schedule & On-Duty Toggle)
  - `priest/consultations.tsx` (Video Counseling & Jitsi Launcher)
  - `admin/index.tsx` (Parish Hub & Operational Triage)
  - `admin/appointments.tsx` (Sacrament Review Queue)
  - `admin/donations.tsx` (Cashless Donations Verification Queue)
  - `messages/index.tsx` (Parish Realtime Chat Threads)
  - `super-admin/index.tsx` (Diocesan Telemetry & KPIs)
  - `super-admin/applications.tsx` (Parish Onboarding Applications)
  - `super-admin/users.tsx` (Diocesan User Directory & Role Assignment)
  - `profile/index.tsx` (Universal profile showing full name, email, role badge, KeyStore status, and functional Sign Out button)
- Wrapped `mobile/app/_layout.tsx` with `<AuthProvider>`, loading splash spinner, and reactive route protection guards.
- Static validation verified with zero errors: `npx tsc --noEmit` and `npx expo export --platform android` (Hermes bytecode bundled 6.6MB).
