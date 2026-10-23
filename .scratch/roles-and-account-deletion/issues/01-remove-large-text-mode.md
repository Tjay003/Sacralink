# 01: Remove Large Text mode

Type: task
Status: ready-for-agent
**Blocked by:** None

**What to build:** Remove the "Large text mode" toggle from the sidebar and the behavior behind it. `web/src/components/layout/DashboardLayout.tsx` holds `largeTextMode` state (line ~54), applies `text-lg` to the root div (~262), and renders the toggle row (~339 to ~360, in the bottom section next to the church pill and Sign out). Delete all of it, including any now-unused imports (for example the `Type` icon) and the stale comment "Accessibility Toggle". No other file references it (`grep -ri "large.\?text" web/src`).

- [ ] No "Large text mode" row in the sidebar for any role, expanded or collapsed.
- [ ] No `largeTextMode` state or `text-lg` conditional left in `DashboardLayout.tsx`.
- [ ] The sidebar bottom section still shows the church pill and Sign out with the same spacing.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` and lint are clean.

**Test plan:** cosmetic removal, no new test (per `docs/agents/test-workflow.md`). Run `responsive-no-horizontal-scroll.spec.ts` to confirm the layout still holds.
