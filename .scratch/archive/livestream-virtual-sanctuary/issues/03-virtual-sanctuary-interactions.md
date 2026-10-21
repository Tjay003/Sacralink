# 03: Virtual Sanctuary Interactive Sidebar & Tabs

Type: task
Status: resolved
Blocked by: 01, 02

## Summary
Implement the interactive companion panels for the Virtual Sanctuary: Liturgical Daily Readings, Mass Intentions Roster, Real-Time Candle Lighting, and In-Stream Cashless Offertory.

## Scope & Implementation Details
1. Create `web/src/components/livestream/VirtualSanctuarySidebar.tsx`:
   - **Tab 1: Daily Readings & Liturgy**:
     - Pulls or renders liturgical readings for the day (First Reading, Responsorial Psalm, Gospel) with a clean, readable typography view.
   - **Tab 2: Today's Mass Intentions**:
     - Queries `appointments` for sacrament types like `mass_intention` or approved intentions for the current date/church, categorized into:
       - Thanksgiving Intentions
       - Memorial / For the Souls Intentions
       - Healing / Special Intentions
   - **Tab 3: Digital Offertory / Love Offering**:
     - Displays the church's GCash and Maya QR codes.
     - Allows parishioners to upload payment screenshot and input reference number directly in an in-stream modal without interrupting the live video.
2. Create `web/src/components/livestream/SpiritualReactionsBar.tsx`:
   - 🕯️ **"Light a Virtual Candle" Button**:
     - Prompts for a short silent intention (optional).
     - Calls `light_church_candle` RPC.
     - Optimistically increments count and triggers a warm, glowing candle animation.
   - 🕊️ **"Amen" / "Peace be with you" Buttons**:
     - Triggers floating spiritual reaction bubbles over the stream UI.
3. Integrate into `web/src/pages/churches/ChurchDetailPage.tsx` and create a dedicated full-screen Virtual Sanctuary view if desired.

## Acceptance Criteria
- [x] Daily readings and mass intentions render clearly in tabs.
- [x] Lighting a candle updates the database and increments the UI counter.
- [x] Offertory allows submitting donation proof without losing video stream state.

## Resolution
- Created `web/src/lib/liturgy.ts` with liturgical calendar logic, Catholic daily readings (First Reading, Responsorial Psalm, Gospel), liturgical colors, and cycles.
- Created `web/src/components/livestream/SpiritualReactionsBar.tsx` featuring real-time `light_church_candle` RPC integration, optimistic count updates, floating particle reactions ("Amen", "Peace be with you", "Lord hear our prayer", "Deo Gratias", "God Bless"), and Supabase broadcast channel synchronization.
- Created `web/src/components/livestream/VirtualSanctuarySidebar.tsx` with Daily Readings tab, categorized Mass Intentions roster, and in-stream Cashless Offertory with QR preview and donation proof submission.
- Created `web/src/components/livestream/VirtualSanctuarySection.tsx` and seamlessly integrated it into `web/src/pages/churches/ChurchDetailPage.tsx`.
