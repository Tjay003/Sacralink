# Issue 03: Android SafeAreaView & Flexbox Gap Layout Fixes

Type: task  
Status: resolved  
Blocked by: 01  

## Description
Resolve layout bugs on Android devices caused by iOS-only `SafeAreaView` imports and fragile NativeWind v4 sibling margin utilities.

## Scope of Work
1. Update `mobile/app/(tabs)/messages/index.tsx` and `mobile/app/messages/[conversationId].tsx`:
   - Replace `import { SafeAreaView } from 'react-native'` with `import { SafeAreaView } from 'react-native-safe-area-context'`.
   - Ensure header title and bottom message input bar respect status bar and navigation bar insets.
2. Modernize layout spacing across screens:
   - Identify instances of `space-x-*` and `space-y-*` in `mobile/app/(auth)/login.tsx`, `register.tsx`, `church/[id].tsx`, and modal components.
   - Replace with modern Flexbox `gap-*` (`gap-2`, `gap-3`, `gap-4`).

## Acceptance Criteria
- Messaging header and input bar do not clip behind Android status bar or gesture pill.
- Form inputs and button groups maintain proper spacing without collapsing under NativeWind v4.
- `npm run typecheck` passes with 0 errors.

## Resolution
1. **SafeAreaView Modernization**:
   - Replaced iOS-only `SafeAreaView` imports from `'react-native'` with `react-native-safe-area-context` in `mobile/app/(tabs)/messages/index.tsx` and `mobile/app/messages/[conversationId].tsx`.
   - Injected explicit `edges={['top']}` and `edges={['top', 'bottom']}` to ensure headers and input bars properly respect Android status bars and gesture navigation pills.
2. **NativeWind Flexbox Gap Modernization**:
   - Replaced all legacy sibling margin utilities (`space-x-*` and `space-y-*`) with Flexbox `gap-*` utilities across:
     - `mobile/app/(auth)/login.tsx`
     - `mobile/app/(auth)/register.tsx`
     - `mobile/app/church/[id].tsx`
     - `mobile/app/(tabs)/messages/index.tsx`
     - `mobile/app/messages/[conversationId].tsx`
     - `mobile/src/components/chat/ChatInputBar.tsx`
     - `mobile/src/components/chat/ChatMessageItem.tsx`
     - `mobile/src/components/ai/ParishionerChatbotModal.tsx`
     - `mobile/src/components/donations/QRCodeModal.tsx`
3. **Verification**:
   - Verified 0 remaining occurrences of `space-[xy]-` in the target files.
   - Verified `npm run typecheck` passes with 0 errors.
