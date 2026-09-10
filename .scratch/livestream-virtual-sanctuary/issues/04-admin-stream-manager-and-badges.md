# 04: Church Admin Stream Manager & Live Badges

Type: task
Status: resolved
Blocked by: 01, 02

## Summary
Add quick livestream broadcast controls for Church Admins and pulsing live indicators across the web platform.

## Scope & Implementation Details
1. Update `web/src/pages/dashboard/ChurchAdminDashboard.tsx`:
   - Add a "Live Broadcast Manager" card:
     - Toggle switch: **"🔴 Go Live"** (toggles `churches.is_live`).
     - Quick input fields for `livestream_url` and `livestream_title`.
     - Displays live statistics (active candles lit today, viewer counts).
2. Update `web/src/pages/churches/ChurchesPage.tsx` and `ChurchCard.tsx`:
   - Display a pulsing red badge (**"🔴 LIVE MASS"**) on church cards that currently have `is_live = true`.
   - Provide a direct "Watch Live" action button on the card leading to the Virtual Sanctuary.
3. Update `web/src/pages/churches/EditChurchPage.tsx` and `AddChurchPage.tsx` to support the new stream metadata fields.

## Acceptance Criteria
- [x] Church Admin can toggle live status with one click from dashboard.
- [x] Active live streams show prominent pulsing badges in church directory.
- [x] Clicking "Watch Live" navigates directly to the player with autoplay enabled.

## Resolution
- Created `web/src/components/dashboard/LiveBroadcastManager.tsx` featuring Go Live quick toggle, stream URL/title inputs, and live stats (active candles and duration counter).
- Integrated `LiveBroadcastManager` into `web/src/pages/dashboard/ChurchAdminDashboard.tsx`.
- Updated `web/src/pages/churches/ChurchesPage.tsx` across Grid view, Mobile Card view, and Desktop Table view with pulsing `🔴 LIVE MASS` badges and direct "Watch Live" navigation buttons.
- Updated `web/src/pages/churches/EditChurchPage.tsx` and `web/src/pages/churches/AddChurchPage.tsx` with dedicated Livestream & Virtual Sanctuary configuration fields (`is_live`, `livestream_title`, `livestream_platform`, `livestream_url`).
