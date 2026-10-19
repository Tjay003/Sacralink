# Issue 10: App-Wide Realtime Data Synchronization & Reactive Role Updates

Type: bug
Status: resolved
Blocked by: 

---

## 1. Description
Remote clients and production users experience significant latency or complete failure when expecting real-time updates across multiple features:
1. **User Role Updates**: Promoting a user (e.g. to `church_admin` or `is_priest`) requires them to log out and log back in, because `AuthContext.tsx` only loads the profile on login and `profiles` is not broadcasting changes.
2. **QR Code / Payment Info**: Modifying a parish GCash/Maya QR in `EditChurchPage.tsx` does not reflect on remote users' donation modals or church detail screens without a manual page refresh.
3. **Candle Count**: Lighting a candle in the Virtual Sanctuary increments locally via optimistic UI, but remote viewers on other devices do not see the counter increase in real time.
4. **App-Wide Stale State**: Appointments, donations, notifications, and announcements have frontend listeners in code, but PostgreSQL logical replication is disabled because their tables were never added to the PostgreSQL `supabase_realtime` publication.

### Changes Completed
1. **Database Migration (`supabase/migrations/039_enable_app_wide_realtime_publication.sql`)**:
   - Set `REPLICA IDENTITY FULL` on `churches`, `profiles`, `appointments`, `donations`, `notifications`, `church_announcements`, and `system_announcements`.
   - Added all 7 tables to `supabase_realtime` publication via an idempotent PL/pgSQL block.
2. **Reactive `AuthContext.tsx`**:
   - Added a `postgres_changes` listener for `table: 'profiles', filter: id=eq.${user.id}`.
   - When the user's role or assigned church changes, immediately updates `profile` state via `setProfile(payload.new as Profile)` without requiring re-auth or page refresh.
   - Proper unsubscribe lifecycle on unmount and user change.
3. **Reactive `useChurch` Hook (`web/src/hooks/useChurches.ts`)**:
   - Added a `postgres_changes` subscription on `table: 'churches', filter: id=eq.${id}` on channel `church-detail-${id}`.
   - Automatically merges `payload.new` into `church` state so QR codes, contact details, payment information, and broadcast states update immediately across open views.
   - Proper unsubscribe lifecycle on unmount and id change.
4. **Spiritual Reactions Candle Broadcast (`web/src/components/livestream/SpiritualReactionsBar.tsx`)**:
   - In `handleLightCandleSubmit`, broadcasts `candle_lit` event with `{ churchId: church.id, newCount: nextCount }` over the realtime channel.
   - Added listener for `candle_lit` broadcast event in `useEffect` updating local state `setCandleCount(payload.newCount)` and invoking `onCandleCountChange`.

### Files Involved
- `supabase/migrations/039_enable_app_wide_realtime_publication.sql` (new)
- [web/src/contexts/AuthContext.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/contexts/AuthContext.tsx)
- [web/src/hooks/useChurches.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/hooks/useChurches.ts)
- [web/src/components/livestream/SpiritualReactionsBar.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/livestream/SpiritualReactionsBar.tsx)

---

## 2. Acceptance Criteria
- [x] Role changes made in User Management take effect immediately on the target user's screen without logging out or reloading.
- [x] Updated parish QR codes reflect immediately on open church detail pages and donation modals across separate devices.
- [x] Candle lighting increments in real-time across multiple remote client browsers viewing the livestream.
- [x] Realtime subscriptions for appointments, donations, notifications, and announcements receive live database broadcasts.
- [x] Builds and passes TypeScript validation cleanly (`tsc -b`).
