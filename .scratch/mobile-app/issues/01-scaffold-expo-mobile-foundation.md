# Issue 01: Scaffold Expo Mobile Foundation & Configuration

Type: task  
Status: ready-for-agent  
Blocked by: none  

---

## 1. Description
Initialize the React Native (Expo) application in `mobile/` configured with TypeScript, NativeWind v4 (Tailwind CSS), `@supabase/supabase-js` with `expo-secure-store` session encryption, TanStack Query v5 for data caching, and shared domain models.

---

## 2. Acceptance Criteria
- [ ] Expo SDK 52+ project initialized in `mobile/` with TypeScript template.
- [ ] NativeWind v4 installed and configured (`tailwind.config.js`, `global.css`, `babel.config.js`) matching the SacraLink web HSL color palette (`#2563EB` Faith Blue, `#F59E0B` Sacred Gold, `#F8FAFC` Slate).
- [ ] `@supabase/supabase-js` configured with `expo-secure-store` adapter for secure Android KeyStore token persistence.
- [ ] TanStack Query (React Query v5) `QueryClientProvider` configured at root.
- [ ] `lucide-react-native` and `react-native-svg` installed and verified.
- [ ] Types from `shared/types.ts` imported cleanly with path aliases (`@/shared/*` or `../../shared/types`).

---

## 3. Implementation Steps
1. Run `npx create-expo-app@latest mobile --template blank-typescript`.
2. Install NativeWind v4, `tailwindcss`, `react-native-reanimated`, `react-native-safe-area-context`.
3. Install `@supabase/supabase-js`, `expo-secure-store`, `@tanstack/react-query`, `lucide-react-native`, `react-native-svg`.
4. Create `mobile/src/lib/supabase.ts` with SecureStore auth adapter.
5. Create `mobile/app/_layout.tsx` with ThemeProvider, QueryClientProvider, and Font loader (Inter).
