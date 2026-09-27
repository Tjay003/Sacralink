# SacraLink Mobile: Stabilization & Android Readiness Specification

> **Target Directory**: `mobile/`  
> **Status**: In Progress  
> **Originating Audit**: Complete Mobile Architecture & UI/UX Audit  
> **Priority**: P0 (Hygiene & Deep Links) -> P1 (Layout & Theme Compliance) -> P2 (Resilience & Security)

---

## 1. Problem Statement & Motivation

The SacraLink React Native / Expo application (`mobile/`) has an extensive functional feature set (role-based portals for Parishioner, Priest, Admin, and Super Admin; Mass schedules; Leaflet & 360° Pannellum tours; cashless offertory receipts; appointment booking; real-time messaging).

However, after a period of dormancy, the mobile app had accumulated:
1. **Bootstrap Hazards**: Dual entry points (`App.tsx` and `index.ts` vs Expo Router v4 `app/_layout.tsx`) that risk throwing unhandled context exceptions.
2. **Missing Android Build Configurations**: Missing notification plugins and hardware permissions in `app.json`.
3. **Broken Deep Links**: Missing OAuth redirect receiver (`sacralink://auth/callback`) and password reset receiver (`sacralink://reset-password`).
4. **Layout Clipping**: iOS-only `SafeAreaView` from React Native used on messaging screens, and unstable NativeWind v4 sibling margin classes (`space-x-*`/`space-y-*`).
5. **Theme Violations**: Hardcoded dark-mode screens (`bg-slate-900`) in loading views, candle lighting modals, and AI assistant components, violating the mandatory light-mode Vatican Design System (`AGENTS.md`).

This specification defines the phased work packages to stabilize and freeze the mobile app cleanly, leaving it ready for instant resumption once the Web application milestones are complete.

---

## 2. Architecture & Design Principles

1. **Expo Router Exclusivity**: All application bootstrapping and routing flows through `expo-router/entry` into `app/_layout.tsx`. Legacy standalone entry points are permanently removed.
2. **Native Android Parity**: Android permissions (`CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`) and notification channels are properly configured in `app.json`.
3. **Sacralink Theme Token Compliance ("Apple meets The Vatican")**:
   - Primary: Faith Blue (`#2563EB`)
   - Sacred Gold Accent: (`#F59E0B` / `amber-500`)
   - Stone Gray: (`#64748B`)
   - Background: Clean light mode (`#F8FAFC` / `bg-background` / `bg-card`)
   - Zero hardcoded `bg-slate-900` / `bg-black` default card styles.
4. **Stable Layout Geometry**: Replace `space-x-*` / `space-y-*` with Flexbox `gap-*` for 100% reliable layout calculation in React Native's Yoga engine.

---

## 3. Work Breakdown Structure

- **Phase 1: Bootstrap & Android Configuration (Resolved)**
  - Remove legacy `mobile/App.tsx` and `mobile/index.ts`.
  - Add `"typecheck": "tsc --noEmit"` to `mobile/package.json`.
  - Configure `app.json` with Android permissions, `softwareKeyboardLayoutMode`, and `expo-notifications` plugin.
- **Phase 2: Deep Linking & OAuth Handlers**
  - Implement `mobile/app/(auth)/callback.tsx` with token exchange and session recovery.
  - Implement `mobile/app/(auth)/reset-password.tsx`.
  - Configure linking listener in `AuthContext.tsx`.
- **Phase 3: Android Layout & SafeAreaView Fixes**
  - Replace `SafeAreaView` in `mobile/app/(tabs)/messages/index.tsx` and `messages/[conversationId].tsx` with `react-native-safe-area-context`.
  - Convert `space-x-*` and `space-y-*` to `gap-*` across authentication and church detail forms.
- **Phase 4: Sacralink Vatican Light Design Alignment**
  - Replace dark-mode loading views in `app/_layout.tsx` and `app/index.tsx`.
  - Convert Candle Lighting modal and Cashless Offertory bottom sheet in `app/church/[id].tsx` to clean light mode.
  - Convert `AIAssistantFAB.tsx` and `ParishionerChatbotModal.tsx` to theme tokens.
- **Phase 5: Auth Resilience & Security**
  - Add retry and error-handling guards to `fetchProfile` in `AuthContext.tsx` to prevent accidental role demotions.
  - Secure consultation video room generation with passcodes.

---

## 4. Acceptance Criteria
- `npm run typecheck` in `mobile/` exits with 0 errors.
- Expo Router boots cleanly without warning or unhandled provider exceptions.
- Google OAuth and password reset links route to functional handlers.
- Android screens render without notch clipping or soft-keyboard occlusions.
- All screens conform to the Sacralink Vatican Light Design System tokens.
