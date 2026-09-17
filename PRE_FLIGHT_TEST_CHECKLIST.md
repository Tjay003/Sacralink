# SacraLink Pre-Flight Production Test Checklist

Comprehensive pre-flight verification checklist before merging and pushing to production (`origin/main`).

---

## Quick Credentials Reference


| Role             | Email             | Password        | Primary Test Area                                                 |
| :---------------- | :----------------- | :--------------- | :----------------------------------------------------------------- |
| **Super Admin**  | `user1@gmail.com` | `Lolgamers_123` | Parish Applications, Church Security Controls, Ownership Transfer |
| **Church Admin** | `user2@gmail.com` | `lolgamers123`  | Live Broadcast Manager, Parish Dashboard, Messages                |
| **Parishioner**  | `user6@gmail.com` | `lolgamers123`  | Apply Parish, Book Appointment, Donate, Virtual Sanctuary         |


---

## 1. Cashless Donations &amp; Anti-Fraud Verification Gate

- **Target URL**: [http://localhost:5173/churches/def73480-2e25-41f7-aeb9-79e16a82bb4d](http://localhost:5173/churches/def73480-2e25-41f7-aeb9-79e16a82bb4d)
- **Files Involved**:
  - `web/src/pages/churches/ChurchDetailPage.tsx`
  - `web/src/pages/churches/EditChurchPage.tsx`
  - `web/src/components/donations/SubmitDonationModal.tsx`

### Checklist

- [x] **Verified Parish Status**: Verified churches display the green `[Verified Parish]` shield badge.
- [x] **Donation Modal Layout**: Modal header accommodates long parish names with `min-w-0` and `break-words` without overlapping the close (`X`) button.
- [x] **Super Admin Security Switch**: Super Admin sees `[Suspend Donations]` in `ChurchDetailPage.tsx`.
- [x] **Anti-Fraud Lock Execution**: Suspending a church sets `status = 'unverified'`, disables the Donate button, and renders the amber Anti-Fraud warning banner.
- [x] **Re-verification**: Clicking `[Verify Parish]` restores `status = 'verified_active'`, re-enables donations, and restores the green badge.
- [x] **Standby Screen Framing**: Offline ecclesiastical screen in `LivestreamPlayer.tsx` fills vertical height with `bg-secondary-50/50` / `dark:bg-card` (zero black letterbox gap).

---

## 2. Parish Onboarding &amp; Super Admin Approval Pipeline

- **Applicant URL**: [http://localhost:5173/churches/apply](http://localhost:5173/churches/apply)
- **Review URL**: [http://localhost:5173/admin/applications](http://localhost:5173/admin/applications)
- **Files Involved**:
  - `web/src/pages/churches/ApplyParishPage.tsx`
  - `web/src/pages/admin/ParishApplicationsPage.tsx`
  - `web/src/lib/supabase/parishApplications.ts`
- **Risk Checked**: Storage upload failure for private CBCP Clergy ID / Celebret or Chancery decree documents.

### Test Steps

- [x] **Step 1 - Submit Application**:
  - [ ] Log in as test user (`user6@gmail.com`).
  - [ ] Navigate to [http://localhost:5173/churches/apply](http://localhost:5173/churches/apply).
  - [ ] Fill in parish details: Parish Name, Address, Contact Number, GCash/Maya numbers.
  - [ ] Select/drag location coordinates on the Leaflet map pin picker.
  - [ ] Attach dummy files (PDF or JPG) for:
    - [ ] CBCP Clergy ID / Celebret
    - [ ] Diocesan Chancery Appointment Decree
  - [ ] Submit the form. Confirm success confirmation screen appears.
- [x] **Step 2 - Super Admin Review Queue**:
  - [ ] Log in as Super Admin (`user1@gmail.com`).
  - [ ] Open [http://localhost:5173/admin/applications](http://localhost:5173/admin/applications).
  - [ ] Confirm new submission appears under the **Pending** tab.
- [x] **Step 3 - Verification Audit &amp; Approval**:
  - [ ] Click **Review** on the application card.
  - [ ] Verify document viewer preview opens both Celebret and Chancery decree correctly.
  - [ ] Complete the 3 audit checklist checkboxes (Rectory call, Celebret verified, Merchant name matched).
  - [ ] Click **Approve Application**.
- [ ] **Step 4 - Directory Verification**:
  - [ ] Go to [http://localhost:5173/churches](http://localhost:5173/churches).
  - [ ] Confirm the newly approved parish appears in the public directory with the green **[Verified Parish]** badge.
  - [ ] Open its detail page and confirm cashless donations are active.

---

## 3. Smart Cross-Parish Booking Recommender

- **Target URL**: [http://localhost:5173/churches](http://localhost:5173/churches) -&gt; Select church -&gt; **Book Appointment**
- **Direct Example**: [http://localhost:5173/churches/09293785-1ee1-4b2c-a7a4-d6628a9fffd1/book](http://localhost:5173/churches/09293785-1ee1-4b2c-a7a4-d6628a9fffd1/book)
- **Files Involved**:
  - `web/src/pages/appointments/BookAppointmentPage.tsx`
  - `web/src/lib/recommender.ts`
  - `web/src/lib/geo.ts`
- **Risk Checked**: Haversine distance calculation blocking valid bookings or freezing on slot conflicts.

### Test Steps

- [x] **Step 1 - Trigger Conflict**:
  - [ ] Open the sacrament booking page for a parish.
  - [ ] Select a sacrament type (e.g. Baptism or Wedding).
  - [ ] Pick a date/time that has a conflict or where priest availability is unavailable.
- [x] **Step 2 - Verify Recommendation Cards**:
  - [ ] Verify recommendation container appears without breaking the form layout.
  - [ ] **Card A (Same Parish)**: Shows earliest next available slot at the chosen parish.
  - [ ] **Card B (Nearby Diocese Parish)**: Shows nearest active CSJDM parish offering the same sacrament with distance in kilometers.
- [x] **Step 3 - One-Click Auto-Fill**:
  - [ ] Click **"Select This Alternative"** on one of the recommended cards.
  - [ ] Verify booking form automatically populates with the alternative parish/date/time.
  - [ ] Proceed with booking submission and verify status updates to `pending`.

---

## 4. Real-Time In-App Messaging &amp; Jitsi Video Modal

- **Target URL**: [http://localhost:5173/messages](http://localhost:5173/messages)
- **Files Involved**:
  - `web/src/pages/messages/MessagingPage.tsx`
  - `web/src/components/conference/VideoConferenceModal.tsx`
  - `web/src/lib/supabase/messaging.ts`
- **Risk Checked**: Supabase Realtime channel subscription drops or WebRTC / Jitsi embed crashes.

### Test Steps

- [x] **Step 1 - Real-Time Synchronization**:
  - [ ] Open [http://localhost:5173/messages](http://localhost:5173/messages) on **Browser Window 1** logged in as Church Admin (`user2@gmail.com`).
  - [ ] Open [http://localhost:5173/messages](http://localhost:5173/messages) on **Browser Window 2** (or Incognito) logged in as Parishioner (`user6@gmail.com`).
  - [ ] Send a direct message from Window 1 to Window 2.
  - [ ] Confirm message appears instantly in Window 2 without refreshing the browser.
  - [ ] Reply from Window 2 and verify instantaneous delivery back to Window 1.
  - [ ] Verify unread counter badges increment and clear upon viewing.
- [x] **Step 2 - Jitsi Video Consultation**:
  - [ ] In the active conversation header, click **Start Video Consultation** / camera icon.
  - [ ] Verify `VideoConferenceModal.tsx` opens centered with clean dark/light framing.
  - [ ] Confirm Jitsi Meet room initializes and prompts for microphone/camera permissions.
  - [ ] Verify meeting controls (Mute, Video Toggle, Hang Up) work and closing the modal cleanly terminates the session.

---

## 5. Virtual Sanctuary Livestream &amp; Liturgical Reactions

- **Admin URL**: [http://localhost:5173/dashboard](http://localhost:5173/dashboard) (logged in as Church Admin `user2@gmail.com`)
- **Parishioner URL**: [http://localhost:5173/churches/629a4ca0-a374-49b4-a8ca-a8eed8f51532](http://localhost:5173/churches/629a4ca0-a374-49b4-a8ca-a8eed8f51532)
- **Files Involved**:
  - `web/src/components/dashboard/LiveBroadcastManager.tsx`
  - `web/src/components/livestream/LivestreamPlayer.tsx`
  - `web/src/components/livestream/VirtualSanctuarySidebar.tsx`
  - `web/src/components/livestream/SpiritualReactionsBar.tsx`
  - `supabase/migrations/027_livestream_virtual_sanctuary.sql`
- **Risk Checked**: Live video embed parser failing on YouTube/FB URLs or candle counter RPC desync.

### Test Steps

- [x] **Step 1 - Broadcast Activation**:
  - [ ] Log in as Church Admin (`user2@gmail.com`).
  - [ ] In the dashboard, locate the **Live Broadcast Manager** widget.
  - [ ] Enter a test stream URL (e.g. `https://www.youtube.com/watch?v=jfKfPfyJRdk` or Facebook Live permalink).
  - [ ] Set stream title (e.g., *"Sunday Solemn Mass - Feast of St. Joseph"*).
  - [ ] Toggle **"🔴 Broadcast Live"** to ON.
- [x] **Step 2 - Live Indicator Badges**:
  - [ ] Open the church directory [http://localhost:5173/churches](http://localhost:5173/churches).
  - [ ] Confirm the church card displays the pulsing red **"🔴 LIVE MASS"** badge.
- [x] **Step 3 - Universal Video Player**:
  - [ ] Open the church detail page.
  - [ ] Confirm the video plays responsively in 16:9 aspect ratio with fullscreen and audio controls.
- [x] **Step 4 - Virtual Sanctuary Interactions**:
  - [ ] In the sidebar, click **"Light a Candle"**.
  - [ ] Confirm the collective candle counter increments in real-time via `light_church_candle` RPC.
  - [ ] Test the spiritual reaction buttons (Amen, Heart, Pray) and confirm floating animation fires.
  - [ ] Click **"Digital Offertory"** and confirm cashless GCash/Maya QR drawer slides open without pausing the video.
- [x] **Step 5 - Broadcast Deactivation**:
  - [ ] In Church Admin dashboard, toggle broadcast to OFF.
  - [ ] Return to church detail page and confirm player smoothly transitions back to the offline standby screen with next mass schedule countdown.

---

## Production Release Command

Once all items above are checked:

```powershell
# 1. Verify working directory is clean
git status

# 2. Push all commits to production
git push origin main
```

