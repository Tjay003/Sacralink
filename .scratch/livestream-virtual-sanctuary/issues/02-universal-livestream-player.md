# 02: Universal Livestream Player Component

Type: task
Status: resolved
Blocked by: 01

## Summary
Create a robust, responsive stream player component supporting Facebook Live and YouTube Live with zero hosting cost, complete with offline standby state.

## Scope & Implementation Details
1. Create `web/src/components/livestream/LivestreamPlayer.tsx`:
   - URL Parser helper:
     - Detects YouTube links (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/embed/...`, `youtube.com/live/...`) and extracts video/embed ID. Renders `https://www.youtube-nocookie.com/embed/{id}?autoplay=1&rel=0`.
     - Detects Facebook links (`facebook.com/.../videos/...`, `facebook.com/watch/?v=...`, `fb.watch/...`) and generates standard responsive Facebook video player embed iframe.
   - Offline / Standby View:
     - Rendered when `church.is_live` is false or no livestream URL is set.
     - Displays solemn parish cover, next upcoming Mass time from `mass_schedules`, and "Broadcast currently offline" status.
   - Active Live View:
     - 16:9 aspect ratio container with rounded corners and dark backdrop.
     - Red glowing "🔴 LIVE MASS" badge overlay with viewer/candle counter indicator.
     - Fullscreen & Theater mode toggle buttons.

## Acceptance Criteria
- [x] Correctly renders Facebook Live and YouTube Live streams across standard desktop and mobile browser widths.
- [x] Handles malformed or missing URLs gracefully with informative fallback slate.
- [x] Displays next scheduled Mass countdown in offline mode.

## Resolution
- Built `web/src/components/livestream/LivestreamPlayer.tsx` with resilient YouTube Live (video IDs, shortened URLs, embeds, live tags) and Facebook Live iframe generation using `youtube-nocookie.com`.
- Implemented 16:9 responsive frame, Theater mode toggle, fullscreen support, and glowing `🔴 LIVE MASS` stream badges.
- Implemented offline standby state displaying parish metadata, next upcoming mass time calculation from `mass_schedules`, and quick actions to read liturgy, offer intentions, and give digital offertory.
