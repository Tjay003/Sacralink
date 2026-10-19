# Issue 08: Fix Livestream Toggle Switch Button Layout & Overlap

Type: bug
Status: resolved
Blocked by: 

---

## 1. Description
In the Church Admin Dashboard ([web/src/components/dashboard/LiveBroadcastManager.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/dashboard/LiveBroadcastManager.tsx#L202-L237)), the quick live toggle banner (`"Broadcasting to Virtual Sanctuary"` / `"🔴 Go Live Now"`) and header controls can suffer from visual overlap or awkward wrapping on intermediate screen sizes or mobile viewports.

### Changes Required
1. In `LiveBroadcastManager.tsx`:
   - Inspect the quick live toggle switch banner container (`flex flex-col sm:flex-row items-center justify-between gap-4`).
   - Prevent text-label crowding with `shrink-0` on action buttons and `min-w-0 flex-1` on status descriptions.
   - Ensure the toggle button (`"🔴 Go Live Now"` / `"Stop Broadcast"`) has explicit spacing, fixed or responsive alignment, and does not overlap status badges or preview buttons.
   - Refactor the button and switch layout to follow the Sacralink clean card style with zero visual overlapping.

### Files Involved
- [web/src/components/dashboard/LiveBroadcastManager.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/dashboard/LiveBroadcastManager.tsx)

---

## 2. Acceptance Criteria
- [x] No overlapping between the broadcast status text, live indicator dot, and "Go Live Now" button across mobile (375px), tablet (768px), and desktop.
- [x] Responsive padding and alignment strictly adhere to the Sacralink Design System tokens.
- [x] TypeScript check and build pass cleanly (`tsc -b`).

---

## 3. Resolution Details
- Updated the header layout in [LiveBroadcastManager.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/dashboard/LiveBroadcastManager.tsx):
  - Added `min-w-0 flex-1` on the title/description container and `flex-wrap` with `shrink-0` on status pills to prevent text crowding.
  - Added `shrink-0` on the "Preview Sanctuary" button to prevent resizing or collision with headers.
- Updated the Quick Live Toggle Switch Banner in [LiveBroadcastManager.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/dashboard/LiveBroadcastManager.tsx):
  - Applied `min-w-0 flex-1` on the status/text container and `shrink-0` on the pulse dot to prevent label deformation.
  - Applied `shrink-0` on the action button container and `w-full sm:w-auto shrink-0 justify-center` on the "🔴 Go Live Now" / "Stop Broadcast" button for responsive wrapping and clean touch targets.
- Verified build and TypeScript compilation via `npm run build` (`tsc -b && vite build`) with exit code 0.
