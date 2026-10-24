# 04: Public Parish Profile FAQ Accordion with Assistant Deep Linking

Type: task  
**Status:** ready-for-agent  
**Blocked by:** 01  

---

## Problem Statement

Currently, knowledge sections created in `church_knowledge_sections` are only consumed internally by the vector store and the conversational chatbot. Parishioners visiting the public church profile (`ChurchDetailPage.tsx`) have no dedicated place to browse static pastoral guidelines, dress codes, or FAQs without opening the chat assistant and typing a prompt.

Additionally, when a parishioner is reading a static FAQ (e.g. regarding godparent requirements or certificate turnaround) and needs clarification or wants to start a booking, there is no direct link to transition into the interactive AI Parish Assistant.

---

## What to Build

1. **Parish Guide & FAQs Accordion in `ChurchDetailPage.tsx`** (`web/src/pages/churches/ChurchDetailPage.tsx`):
   - Add a new tab to the church profile: **"Parish Guide & FAQs"** (using the `BookOpen` or `HelpCircle` icon), placed logically alongside Liturgy, Announcements, and Media.
   - Fetch `church_knowledge_sections` where `church_id = id` ordered by `display_order` ascending.
   - Features:
     - **Topic Search Bar**: Instant client-side filter searching both titles and content text.
     - **Accordion Cards**: Built with Sacralink cards (`bg-white border border-border rounded-2xl shadow-2xs`).
     - Smooth expand/collapse animation showing topic title, last updated timestamp, and full markdown content.
     - Empty state with welcoming graphic and message when no knowledge sections are published yet.

2. **Deep-Linking Integration with `<ParishAssistant />`** (`web/src/components/ai/ParishAssistant.tsx`):
   - In each accordion card, add a contextual footer CTA:
     `"Have questions about this? Ask Parish Assistant ✨"` (Faith Blue primary link with spark icon).
   - Clicking this CTA triggers deep-linking:
     - Dispatches a custom window event:
       ```ts
       window.dispatchEvent(
         new CustomEvent('sacralink:open-assistant', {
           detail: {
             churchId: currentChurch.id,
             churchName: currentChurch.name,
             query: `Tell me more about: ${section.title}`,
           },
         })
       );
       ```
   - In `ParishAssistant.tsx`:
     - Add `useEffect` listening for `sacralink:open-assistant`.
     - When event fires:
       - Sets `isOpen` to `true` (and saves to `sessionStorage`).
       - Sets `activeChurchId` to the provided `churchId`.
       - Appends or executes the pre-filled inquiry automatically or populates the chat input.
       - Focuses the chat widget so the parishioner can converse effortlessly.

---

## Acceptance Criteria

- [ ] `ChurchDetailPage.tsx` features a "Parish Guide & FAQs" tab visible to all visitors.
- [ ] Active knowledge sections for the parish are rendered in clean, expandable accordion cards.
- [ ] Search input filters accordion items in real time by title and content.
- [ ] Each accordion item displays a "Ask Parish Assistant ✨" button.
- [ ] Clicking the deep-link button opens `<ParishAssistant />`, assigns the active church context, and initiates or seeds the inquiry.
- [ ] Fully responsive on mobile (stacks neatly, touch-friendly tap targets, no horizontal scroll).
- [ ] Adheres strictly to the Sacralink color palette and card tokens (`bg-white`, `border-border`, `text-primary`, `bg-secondary-50`).
- [ ] `tsc -b` and ESLint checks pass cleanly.

---

## Test Verification Plan

1. **Component Test**:
   - Verify `ChurchDetailPage` renders the FAQ tab when sections exist and handles empty states gracefully when none exist.
   - Verify typing in the search box filters out non-matching sections.
2. **Playwright Integration Test**:
   - Navigate to `/churches/:id` as a Parishioner.
   - Click on the "Parish Guide & FAQs" tab.
   - Expand the first accordion item ("Dress Code & Decorum").
   - Click "Ask Parish Assistant ✨".
   - Assert the floating `<ParishAssistant />` opens.
   - Assert the assistant header shows the current church name and the chat prompt references "Dress Code & Decorum".

---

## Comments
