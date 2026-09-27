# Issue 04: Sacralink Vatican Light Design Token Alignment

Type: task  
Status: resolved  
Blocked by: 01  

## Description
Enforce the Sacralink Theme & Design System guidelines mandated in `AGENTS.md` ("Apple meets The Vatican", Clean Light Mode defaults, Faith Blue `#2563EB`, Sacred Gold `#F59E0B`, Stone Gray `#64748B`). Eliminate jarring dark-mode hardcoded screens.

## Scope of Work
1. **Loading Screens**:
   - `mobile/app/_layout.tsx` (lines 61, 107): Replace `bg-slate-900` with `bg-background` (`#F8FAFC`).
   - `mobile/app/index.tsx` (line 11): Replace `bg-slate-900` with `bg-background`.
2. **Church Detail Modals (`mobile/app/church/[id].tsx`)**:
   - Virtual Candle Lighting modal: Convert from dark slate to a warm Vatican light card (`bg-card`, `border-border`, Sacred Gold flame glow).
   - Cashless Offertory bottom sheet: Convert from `bg-slate-900` to `bg-card` with clean typography and high-contrast QR display.
3. **AI Chatbot Components**:
   - `mobile/src/components/ai/AIAssistantFAB.tsx`: Replace `bg-slate-900` with Sacred Gold / Faith Blue styling.
   - `mobile/src/components/ai/ParishionerChatbotModal.tsx`: Replace dark header and background with light-mode card tokens.
4. **Token Normalization**:
   - Replace raw Tailwind colors (`bg-blue-600`, `bg-slate-50`, `border-slate-200`) with semantic tokens (`bg-primary`, `bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`).

## Acceptance Criteria
- Zero instances of `bg-slate-900` or `bg-slate-800` as primary screen backgrounds.
- Candle lighting and offertory modals feel coherent with the rest of the clean light-mode application.
- `npm run typecheck` passes with 0 errors.

## Resolution
- **`mobile/app/index.tsx`**: Replaced `bg-slate-900` loading fallback with semantic token `bg-background`.
- **`mobile/app/_layout.tsx`**: Replaced `bg-slate-50` loading fallbacks with semantic token `bg-background`.
- **`mobile/app/church/[id].tsx`**:
  - Converted initial loading screen from `bg-slate-900` to `bg-background` with `text-muted-foreground`.
  - Converted "Ask Parish AI Assistant" action card to `bg-white border border-amber-200 rounded-2xl shadow-sm` with `text-foreground` and `Sparkles color="#F59E0B"`.
  - Converted "Chat Parish" action card to `bg-white border border-border rounded-2xl shadow-sm` with `text-foreground` and `MessageCircle color="#2563EB"`.
  - Converted Virtual Candle Lighting modal from dark slate (`bg-slate-900 border-amber-500/40`) to warm Vatican light card (`bg-white border border-amber-200 rounded-3xl shadow-xl`), Sacred Gold flame accents, clean accessible typography, and amber action button.
  - Converted Cashless Offertory bottom sheet from dark slate (`bg-slate-900`) to clean light mode (`bg-white border-t border-border rounded-t-3xl shadow-xl`), high-contrast QR container, GCash/Maya light cards (`bg-blue-50`, `bg-emerald-50`), and primary action buttons.
  - Normalized section headers, day selector pills, and schedule cards to semantic tokens (`text-foreground`, `border-border`, `bg-primary`).
- **`mobile/src/components/ai/AIAssistantFAB.tsx`**:
  - Replaced `bg-slate-900 border-2 border-amber-500` with Vatican light floating button (`bg-white border border-amber-300 shadow-lg`), Sacred Gold Sparkles icon (`#F59E0B`), and `text-foreground` label.
- **`mobile/src/components/ai/ParishionerChatbotModal.tsx`**:
  - Replaced modal background `bg-slate-900` and header with clean light mode (`bg-white border-b border-border shadow-xs`).
  - Styled parish selector pill with liturgical gold accents (`bg-amber-50 border border-amber-200`, `text-amber-900`).
  - Updated user message bubbles to `bg-primary` and assistant bubbles to `bg-white border border-border`.
  - Updated input bar to `bg-white border-t border-border` with `bg-secondary-50 border border-border` input and `bg-primary` send button.
  - Normalized text colors in `renderFormattedContent` and Church Picker modal to `text-foreground` and `text-muted-foreground`.
- **Validation**:
  - Executed `npm run typecheck` in `mobile/` with 0 TypeScript errors.
  - Verified 0 instances of dark slate backgrounds remaining in application screens.
