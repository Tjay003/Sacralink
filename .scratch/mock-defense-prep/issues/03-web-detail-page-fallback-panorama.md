# Issue 03: Web Detail Page Fallback Photosphere

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
On Web in `web/src/pages/churches/ChurchDetailPage.tsx`, the 360° Virtual Sanctuary card is only rendered if `church.panorama_url` is truthy. In the live database, parishes without a custom uploaded 360° photo will hide the 360 viewer completely.

On Mobile (`mobile/src/components/churches/PanoramaViewerWebView.tsx`), a fallback sample sanctuary panorama URL is used so the 360° Virtual Sanctuary is always visible and interactable.

Mirror this behavior on Web by defining a fallback panorama URL (`https://oaczurouvaevebpimply.supabase.co/storage/v1/object/public/church-images/panoramas/b2tabj6xh1v.jpg`) so that visiting any parish on Web (such as La Salette or Sacred Heart) renders the interactive 360° viewer.

---

## 2. Acceptance Criteria
- [x] `ChurchDetailPage.tsx` displays the 360° Virtual Sanctuary for all parishes using fallback photosphere if `church.panorama_url` is null.
- [x] `npm run build` in `web/` passes with 0 errors.

---

## 3. Resolution & Verification
- Defined `FALLBACK_PANORAMA_URL` in `web/src/pages/churches/ChurchDetailPage.tsx` matching the mobile fallback URL.
- Computed `activePanoramaUrl = church.panorama_url || FALLBACK_PANORAMA_URL`.
- Ensured the 360° Virtual Sanctuary Tour card in `ChurchDetailPage.tsx` renders unconditionally for all parishes.
- Added `activePanoramaUrl` prop to `VirtualSanctuarySection` and `LivestreamPlayer` for fallback ambient display.
- Successfully verified with `npm run build` in `web/` (0 errors, build completed clean in ~11s).

### Modified Files:
- `web/src/pages/churches/ChurchDetailPage.tsx`
- `web/src/components/livestream/VirtualSanctuarySection.tsx`
- `web/src/components/livestream/LivestreamPlayer.tsx`

