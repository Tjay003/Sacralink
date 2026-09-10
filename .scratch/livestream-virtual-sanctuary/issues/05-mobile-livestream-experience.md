# 05: Mobile App Livestream Experience

Type: task
Status: resolved
Blocked by: 01, 02

## Summary
Enhance the mobile app to support the in-app livestream player, live badges on map/cards, and quick spiritual candle/offertory actions.

## Scope & Implementation Details
1. Update `mobile/app/church/[id].tsx`:
   - Replace generic external linking with an embedded `react-native-webview` / YouTube/Facebook player.
   - Add interactive **"🕯️ Light a Candle"** button with haptic feedback.
   - Add **"🪙 Offertory / Love Offering"** quick sheet.
2. Update `mobile/src/components/churches/ParishCard.tsx` and `mobile/src/components/maps/ParishMapWebView.tsx`:
   - Render pulsing **"🔴 LIVE"** badge when `church.is_live` is true.

## Acceptance Criteria
- [x] Livestream plays smoothly in mobile webview without launching external browser.
- [x] Mobile users can light virtual candles and view offertory QR codes in-app.
- [x] Live status badges render on mobile parish cards and map markers.

## Resolution
- Created `mobile/src/components/livestream/MobileLivestreamPlayer.tsx` featuring embedded `react-native-webview` iframe streaming with zero-cost YouTube and Facebook video parsing, fullscreen modal, and offline timetable standby mode.
- Updated `mobile/src/lib/supabase/churches.ts` with `is_live`, `livestream_title`, `livestream_platform`, `candle_count`, and `lightChurchCandle` RPC invocation.
- Updated `mobile/app/church/[id].tsx` with embedded `MobileLivestreamPlayer`, Realtime Supabase change subscriptions, haptic Virtual Candle Lighting modal (`Vibration.vibrate(50)`), and Cashless Offertory bottom sheet with `expo-clipboard` support.
- Updated `mobile/src/components/churches/ParishCard.tsx` and `mobile/src/components/maps/ParishMapWebView.tsx` with animated pulsing `🔴 LIVE MASS` badges and illuminated map pin markers.
