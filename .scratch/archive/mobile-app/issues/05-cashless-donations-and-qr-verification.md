# Issue 05: Cashless Donations & QR Verification Pipeline

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Implement the cashless parish donation flow on mobile allowing parishioners to view GCash/Maya QR codes, upload payment receipts, provide transaction reference numbers, and track donation verification status.

---

## 2. Acceptance Criteria
- [x] Parish QR Code viewer with GCash and Maya tabs, zoom/save options, and merchant details.
- [x] Donation submission form (`app/donations/give.tsx`):
  - Amount input & purpose selector (General, Mass Offering, Tithes, Building Fund).
  - Screenshot receipt picker with image preview and compression.
  - GCash/Maya reference number input.
- [x] Direct upload to private `donation-proofs` Supabase Storage bucket.
- [x] "Donations History" screen (`app/(tabs)/donations/index.tsx`) showing status badges (`pending`, `verified`, `rejected`) and receipt preview lightbox.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/donations.ts`.
2. Build `mobile/src/components/donations/QRCodeModal.tsx`.
3. Build `app/donations/give.tsx` donation form.
4. Build `app/(tabs)/donations/index.tsx` ledger view.

---

## 4. Resolution
- Created `mobile/src/lib/supabase/donations.ts` providing full Supabase integration:
  - `getChurchPaymentInfo(churchId)` with active QR URL resolution and fallback support.
  - `compressDonationReceipt(uri)` utilizing `expo-image-manipulator` ensuring screenshots <200KB.
  - `submitDonation(...)` uploading receipts to `donation-proofs` storage bucket with signed URLs and fallback to `church-images/donations`, and recording donations with purpose, amount, reference number, donor notes, and status.
  - `getUserDonations(userId)` querying donations joined with church details and computing total verified contributions.
  - TanStack Query hooks: `useUserDonations()`, `useChurchPaymentInfo()`, and `useSubmitDonation()`.
- Added migration `supabase/migrations/030_add_donation_purpose_and_notes.sql` and applied columns to remote Supabase DB.
- Built `mobile/src/components/donations/QRCodeModal.tsx` supporting GCash and Maya tabs, zoom lightbox preview, one-tap clipboard copy for account numbers with visual feedback, and a 3-step payment guide.
- Built `mobile/app/donations/give.tsx` featuring parish selector, purpose pills, preset and custom amount inputs, QR modal trigger, screenshot picker (camera/gallery) with compression preview and replace/remove actions, reference number validation, donor prayer intentions, and submission feedback.
- Enhanced `mobile/app/(tabs)/donations/index.tsx` with total verified contributions summary card, filter tabs (All, Pending, Verified, Rejected) with live count badges, formatted donation cards, full inspection modal with receipt preview and admin remarks/rejection notes, full-screen image lightbox, and pull-to-refresh.
- Validated with TypeScript static typing (`npx tsc --noEmit`) passing with 0 errors.
- Verified Hermes Android compilation (`npx expo export --platform android`) generating Hermes bytecode bundle with 0 errors.
