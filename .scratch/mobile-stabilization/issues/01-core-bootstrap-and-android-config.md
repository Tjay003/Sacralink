# Issue 01: Core Bootstrap & Android Config Stabilization

Type: task  
Status: resolved  
Blocked by: none  

## Description
Eliminate dead scaffolding entry files that threaten runtime crashes and configure essential Android build plugins and permissions.

## Tasks
- [x] Delete `mobile/App.tsx` and `mobile/index.ts` to prevent dual-entry conflicts with `expo-router/entry`.
- [x] Add `"typecheck": "tsc --noEmit"` to `mobile/package.json`.
- [x] Update `mobile/app.json` with Android permissions (`CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`).
- [x] Add `softwareKeyboardLayoutMode: "pan"` and `"expo-notifications"` plugin in `mobile/app.json`.
- [x] Verify static compilation via `npm run typecheck`.

## Resolution
Removed `mobile/App.tsx` and `mobile/index.ts`. Updated `package.json` with `typecheck` script and configured `app.json` with Android hardware/notification plugins and permissions. `npm run typecheck` passes with 0 errors.
