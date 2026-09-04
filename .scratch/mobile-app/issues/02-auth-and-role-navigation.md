# Issue 02: Mobile Authentication & Dynamic Role-Adaptive Navigation

Type: task  
Status: ready-for-agent  
Blocked by: 01  

---

## 1. Description
Build the complete mobile authentication flow (Login, Register, Forgot Password, Google OAuth) with session persistence and implement the dynamic role-adaptive bottom tab navigation for `user`, `priest`, `church_admin`, and `super_admin`.

---

## 2. Acceptance Criteria
- [ ] Mobile `AuthContext.tsx` with `signIn`, `signUp`, `signInWithGoogle`, `signOut`, and `refreshProfile`.
- [ ] Login screen (`app/(auth)/login.tsx`) with email/password validation and "Invalid email or password" vs "Email not confirmed" error handling.
- [ ] "Resend Confirmation Email" action on unconfirmed email errors.
- [ ] Register screen (`app/(auth)/register.tsx`) with password strength indicator.
- [ ] Role-adaptive root navigator (`app/(tabs)/_layout.tsx`):
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
