# Issue 06: Rate Limiting for AI Chatbot and Appointment Bookings

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Protect platform resources and Gemini API quotas from exhaustion, and eliminate slot-hogging bot floods on appointment reservations.

### Requirements:
1. **AI Chatbot Sliding Window (`ChurchChatbot.tsx` & `aiFallback.ts`)**:
   - Limit: **10 messages per 5 minutes** per user session.
   - Maintain timestamps in client session storage.
   - When exceeded, render an empathetic in-chat notice:
     *"You have reached the temporary inquiry limit. Please wait a few minutes or contact the parish office directly for immediate assistance."*
   - Auto-reset when the window expires.
2. **Database Appointment Booking Limit (`037_limit_concurrent_pending_appointments.sql`)**:
   - Create a PostgreSQL before-insert trigger on `public.appointments`:
     - Checks if the user already has 3 appointments with `status = 'pending'`.
     - If `COUNT(*) >= 3`, raise exception:
       *`"You have reached the limit of 3 pending sacrament appointments. Please await confirmation before submitting additional requests."`*
   - Return clean friendly error toast to the user in `BookAppointmentPage.tsx`.
3. **UI Double-Submit Protection**:
   - Add debouncing / disabled loading state to the submit button on `BookAppointmentPage.tsx` and `DonationsPage.tsx` modal, preventing rapid repeated clicks from creating duplicate bookings.

---

## 2. Acceptance Criteria
- [x] AI Chatbot enforces 10 msgs / 5 mins limit with pastoral user notification.
- [x] Database migration `037_limit_concurrent_pending_appointments.sql` prevents users from having >3 pending bookings.
- [x] Attempting to submit a 4th pending booking displays the clear friendly message in UI.
- [x] Submit buttons disabled while network request is in-flight.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Comments

## Resolution Details
1. **Migration 037 (`supabase/migrations/037_limit_concurrent_pending_appointments.sql`)**:
   - Created PostgreSQL before-insert trigger function `public.check_pending_appointments_limit()` on `public.appointments`.
   - Rejects insert with exception `"You have reached the limit of 3 pending sacrament appointments. Please await confirmation before submitting additional requests."` if user already has 3 pending appointments.
   - Attached trigger `trg_check_pending_appointments_limit` and appended to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`.
2. **AI Chatbot Sliding Window Rate Limiting (`web/src/lib/supabase/aiFallback.ts` & `web/src/components/ai/ChurchChatbot.tsx`)**:
   - Implemented `checkAIChatRateLimit()`, `recordAIChatQuery()`, and `getRecentAIChatTimestamps()` managing a sliding 5-minute window (`300,000 ms`) with max 10 requests using `sessionStorage` key `sacralink_ai_chat_timestamps`.
   - Automatically prunes expired timestamps from the sliding window.
   - In `ChurchChatbot.tsx` and `aiFallback.ts`, displays empathetic in-chat notice when limit is hit: `"You have reached the temporary inquiry limit. Please wait a few minutes or contact the parish office directly for immediate assistance."`
3. **Appointment Booking UI Double-Submit Debounce & Error Handling (`BookAppointmentPage.tsx`)**:
   - Added `if (submitting) return;` guard preventing rapid multi-clicks.
   - Disabled button and displayed animated spinner + `"Submitting Request..."` during network flight.
   - Added specific error handler catching the 3-pending limit exception and rendering a dedicated amber pastoral alert banner.
   - Also added `if (loading) return;` double-submit guards to `SubmitDonationModal.tsx` and `DonationDetailModal.tsx`.
4. **Validation**:
   - `npx tsc -b`: 0 errors.
   - `npm run build`: built in 11.05s cleanly.
