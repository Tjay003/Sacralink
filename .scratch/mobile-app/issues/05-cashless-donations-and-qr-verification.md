# Issue 05: Cashless Donations & QR Verification Pipeline

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Implement the cashless parish donation flow on mobile allowing parishioners to view GCash/Maya QR codes, upload payment receipts, provide transaction reference numbers, and track donation verification status.

---

## 2. Acceptance Criteria
- [ ] Parish QR Code viewer with GCash and Maya tabs, zoom/save options, and merchant details.
- [ ] Donation submission form (`app/donations/give.tsx`):
  - Amount input & purpose selector (General, Mass Offering, Tithes, Building Fund).
  - Screenshot receipt picker with image preview and compression.
  - GCash/Maya reference number input.
- [ ] Direct upload to private `donation-proofs` Supabase Storage bucket.
- [ ] "Donations History" screen (`app/(tabs)/donations/index.tsx`) showing status badges (`pending`, `verified`, `rejected`) and receipt preview lightbox.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/donations.ts`.
2. Build `mobile/src/components/donations/QRCodeModal.tsx`.
3. Build `app/donations/give.tsx` donation form.
4. Build `app/(tabs)/donations/index.tsx` ledger view.
