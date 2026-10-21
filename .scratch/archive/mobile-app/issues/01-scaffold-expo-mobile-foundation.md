# Issue 01: Scaffold Expo Mobile Foundation & Configuration

Type: task  
Status: resolved  
Blocked by: none  

---

## 1. Description
Initialize the React Native (Expo) application in `mobile/` configured with TypeScript, NativeWind v4 (Tailwind CSS), `@supabase/supabase-js` with `expo-secure-store` session encryption, TanStack Query v5 for data caching, and shared domain models.

---

## 2. Acceptance Criteria
- [x] Expo SDK 52+ project initialized in `mobile/` with TypeScript template.
- [x] NativeWind v4 installed and configured (`tailwind.config.js`, `global.css`, `babel.config.js`) matching the SacraLink web HSL color palette (`#2563EB` Faith Blue, `#F59E0B` Sacred Gold, `#F8FAFC` Slate).
- [x] `@supabase/supabase-js` configured with `expo-secure-store` adapter for secure Android KeyStore token persistence.
- [x] TanStack Query (React Query v5) `QueryClientProvider` configured at root.
- [x] `lucide-react-native` and `react-native-svg` installed and verified.
- [x] Types from `shared/types.ts` imported cleanly with path aliases (`@/shared/*` or `../../shared/types`).

---

## 3. Implementation Steps
1. Run `npx create-expo-app@latest mobile --template blank-typescript`.
2. Install NativeWind v4, `tailwindcss`, `react-native-reanimated`, `react-native-safe-area-context`.
3. Install `@supabase/supabase-js`, `expo-secure-store`, `@tanstack/react-query`, `lucide-react-native`, `react-native-svg`.
4. Create `mobile/src/lib/supabase.ts` with SecureStore auth adapter.
5. Create `mobile/app/_layout.tsx` with ThemeProvider, QueryClientProvider, and Font loader (Inter).

---

## 4. Resolution
- **Project Scaffold**: Initialized Expo SDK 57 app with React Native 0.86, React 19, and TypeScript.
- **Expo Router & Fonts**: Installed and configured `expo-router` v4, `expo-font`, and `@expo-google-fonts/inter` with splash screen auto-hide lifecycle management.
- **NativeWind v4 & Styling**: Configured `tailwind.config.js`, `metro.config.js` (`withNativeWind`), `babel.config.js`, `global.css`, and `nativewind-env.d.ts` matching SacraLink's Faith Blue (`#2563EB`), Sacred Gold (`#F59E0B`), Emerald (`#10B981`), and Slate-50 background palette.
- **Hardware-Encrypted Auth Storage**: Implemented `mobile/src/lib/supabase.ts` using `expo-secure-store` with chunking below 1800 bytes to prevent Android KeyStore 2048-byte limit truncation.
- **Environment Configuration**: Populated `mobile/.env` and `mobile/.env.example` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` matching `web/.env`.
- **Path Aliasing**: Configured `mobile/tsconfig.json` with `@/*`, `@/shared/*`, and `@/shared` aliases pointing to `../shared/types.ts`.
- **Verification Screen**: Built `mobile/app/index.tsx` featuring NativeWind cards, Lucide icons (`Church`, `Cross`, `ShieldCheck`), live Supabase query telemetry, and shared type validation.
- **Static & Build Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npx expo export --platform android` compiled 3,620 modules into Hermes Bytecode bundle without errors.
