# SacraLink Mobile Stabilization: Dependency Map & Task Tracker

> **Specification**: [`spec.md`](./spec.md)  
> **Target**: React Native (Expo) Android App (`mobile/`)  
> **Status**: Active (Step 1 Resolved; Steps 2-5 Ready for Execution)

---

## Decisions Log
1. **Bootstrap Sanitation**: Removed dead `App.tsx` and `index.ts` to guarantee Expo Router v4 canonical booting via `app/_layout.tsx`.
2. **Android Configuration**: Injected `CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, and `POST_NOTIFICATIONS` into `mobile/app.json` with `"softwareKeyboardLayoutMode": "pan"`.
3. **Execution Sequencing**: Stabilize hygiene items immediately so mobile compiles cleanly; keep remaining tickets ready in `.scratch/` while prioritizing Web development.

---

## Implementation Tasks

| # | Ticket | Type | Status | Blocked By |
|---|:---|:---|:---:|:---|
| **01** | [`01-core-bootstrap-and-android-config.md`](./issues/01-core-bootstrap-and-android-config.md) | `task` | `resolved` | — |
| **02** | [`02-oauth-callback-and-password-reset-deep-links.md`](./issues/02-oauth-callback-and-password-reset-deep-links.md) | `task` | `resolved` | 01 |
| **03** | [`03-safe-area-and-flexbox-gap-layout-fixes.md`](./issues/03-safe-area-and-flexbox-gap-layout-fixes.md) | `task` | `resolved` | 01 |
| **04** | [`04-sacralink-vatican-light-design-token-alignment.md`](./issues/04-sacralink-vatican-light-design-token-alignment.md) | `task` | `resolved` | 01 |
| **05** | [`05-auth-resilience-and-pastoral-video-security.md`](./issues/05-auth-resilience-and-pastoral-video-security.md) | `task` | `resolved` | 02 |
