# Issue 01: Dual-Tier Frictionless Donations (Quick Offertory vs. Recorded Acknowledgment)

Type: feature
Status: proposed
Blocked by: 

---

## 1. Description
Casual donors (especially during livestreams or one-time love offerings) face excessive friction because they are forced to type 13-digit reference numbers and upload payment screenshots. Full gateway redirects (e.g. automated GCash API) require formal corporate merchant aggregator accounts (PayMongo / Maya Business) which individual chapels lack.

To solve this:
1. **Tier A (Default - Quick Love Offering)**: Display parish QR code with 1-tap "Copy GCash Number" and "Save QR Image" buttons. Provide a single primary action: `"I have sent my offering"`. Submitting shows a liturgical blessing and increments aggregate offertory metrics without requiring any text input or file uploads.
2. **Tier B (Opt-in - Official Acknowledgment)**: Provide an optional toggle checkbox: `[ ] Request Official Parish Acknowledgment / Mass Intention Receipt`. When checked, smoothly expand inputs for Amount (with preset tap chips `₱50`, `₱100`, `₱200`, `₱500`), Reference Number, and Screenshot dropzone.

### Files Involved
- [web/src/components/donations/SubmitDonationModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/donations/SubmitDonationModal.tsx)
- [web/src/components/livestream/VirtualSanctuarySidebar.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/livestream/VirtualSanctuarySidebar.tsx)
- [web/src/lib/supabase/donations.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/donations.ts)

---

## 2. Acceptance Criteria
- [ ] Donation modal renders parish QR code with "Copy Number" and "Save QR" utility buttons.
- [ ] Default state allows zero-input completion ("I have sent my offering") with spiritual blessing animation.
- [ ] Opt-in checkbox expands form for donor acknowledgment, amount chips, and receipt upload.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
