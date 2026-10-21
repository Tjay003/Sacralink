# Issue 05: Auth Resilience & Pastoral Video Consultation Security

Type: task  
Status: resolved  
Blocked by: 02  

## Description
Protect Priest and Admin accounts from accidental permission downgrades on transient network dropouts, and secure pastoral video counseling rooms from public eavesdropping.

## Scope of Work
1. **Auth Resilience in `mobile/src/contexts/AuthContext.tsx`**:
   - In `fetchProfile`, do not silently swallow network failures and leave `profile = null`.
   - Implement exponential retry (or error banner) so users are not silently defaulted to role `'user'` when in areas with weak cellular reception.
2. **Consultation Room Security in `mobile/src/lib/supabase/messaging.ts` & `consultations.tsx`**:
   - Replace predictable public Jitsi room URLs (`meet.jit.si/pastoral-priest-XXXX`) with cryptographically generated UUIDs or passcodes stored in the consultation session table.
   - Restrict room entry to the verified parishioner and priest assigned to the appointment.

## Acceptance Criteria
- Priests/Admins navigating in poor signal do not experience unexpected UI role demotions.
- Pastoral counseling video URLs cannot be guessed or accessed by unauthenticated third parties.
- `npm run typecheck` passes with 0 errors.

## Resolution
1. **Auth Resilience & Offline Fallback** (`mobile/src/contexts/AuthContext.tsx`, `mobile/app/_layout.tsx`):
   - Implemented 3-attempt exponential backoff retry loop with 6-second timeout per attempt in `fetchProfile`.
   - Persisted last known profile to `expo-secure-store` (`sacralink_cached_profile_<userId>`) on every successful live fetch.
   - If network or server requests fail all retries, automatically restores cached profile from SecureStore with `isOfflineFallback: true`, preventing role lockouts.
   - Added `profileError` state to `AuthContextType`.
   - In `mobile/app/_layout.tsx` (`RootNavigation`), prevented auto-defaulting to parishioner role when profile fetch fails; surfaced an accessible retry / sign-out screen if authenticated session exists without a cached profile.
   - Guarded in-memory profile state against accidental `null` overwrites during session listener callbacks and background token refreshes.

2. **Pastoral Video Room Cryptographic Security** (`mobile/src/lib/supabase/messaging.ts`, `mobile/app/(tabs)/priest/consultations.tsx`, `mobile/app/messages/[conversationId].tsx`):
   - Implemented `generateSecureRoomId(prefix)` with 128-bit cryptographic entropy (`crypto.randomUUID` / `crypto.getRandomValues`).
   - Implemented `generateAppointmentRoomId(appointmentId)` combining full appointment UUID with a pastoral cryptographic checksum salt.
   - Replaced predictable URLs (`pastoral-priest-XXXX` and truncated `counseling-XXXX`) with high-entropy unguessable room identifiers.
   - Enforced Jitsi Meet prejoin screening (`config.prejoinPageEnabled=true` and `config.requireDisplayName=true`) in `getJitsiMeetUrl`.
   - Added role-based access verification in `handleLaunchMeeting` within `consultations.tsx` ensuring only assigned priests, verified parishioners, or authorized admins can join.
   - Added encrypted room URL copy functionality (`handleCopyMeetingLink`) via `expo-clipboard`.
   - Wired dynamic room URLs in active chat conversations (`mobile/app/messages/[conversationId].tsx`).

3. **Validation**:
   - Executed `npm run typecheck` in `mobile/` with 0 errors.
