# 01: Remove Bible Verse on staff/admin dashboards, hide Transfer of Ownership, hide Super Admin livestream controls, and hide Chatbot Neural Pipeline UI

Type: task
**Blocked by:** None (can start immediately)
**Status:** done

**What to build:** Implement four role-visibility and UI cleanup adjustments requested by the client (hiding controls in the UI rather than deleting underlying components/RPCs so they can be restored easily if ever needed):

1. **Remove Bible Verse (`<DailyVerse />`) for `super_admin`, `priest`, and `church_admin`**:
   - In `web/src/pages/dashboard/SuperAdminDashboard.tsx`, remove `<DailyVerse variant="parchment" />` and let `NeedsYourAttentionWidget` span the full row width (`lg:col-span-2` or single column).
   - In `web/src/pages/dashboard/ChurchAdminDashboard.tsx`, remove `<DailyVerse variant="parchment" />` and let `ParishAttentionWidget` span the full row width.
   - In `web/src/pages/dashboard/PriestDashboard.tsx`, remove `<DailyVerse ... />` from the right column.
   - Keep `<DailyVerse />` untouched on `UserDashboard.tsx` (Parishioner) and `VolunteerDashboard.tsx` (Volunteer).
2. **Hide Transfer of Ownership in Role Management**:
   - In `web/src/components/admin/EditRoleModal.tsx`, hide the `"Platform Ownership Transfer"` card/button (e.g. set `canTransferOwnership = false` and remove "Transfer Ownership" from helper copy).
   - In `web/src/pages/admin/UsersPage.tsx`, update the locked role tooltip on Super Admin rows to `"Platform Owner role cannot be modified."` (keeping `TransferOwnershipModal.tsx` intact in the repo).
3. **Hide Super Admin Access to Conduct / Configure Livestreams**:
   - In `web/src/pages/dashboard/ChurchAdminDashboard.tsx`, only render `<LiveBroadcastManager churchId={churchId} />` when `profile?.role === 'church_admin'` (hiding it when `super_admin` views a church dashboard from `SuperAdminDashboard.tsx`).
   - In `web/src/pages/churches/ChurchDetailPage.tsx`, pass `canManage={profile?.role === 'church_admin' && profile?.assigned_church_id === church.id}` to `<VirtualSanctuarySection />` so `super_admin` sees the livestream viewer without the `"Studio Controls"` button.
   - In `web/src/pages/churches/AddChurchPage.tsx` and `web/src/pages/churches/EditChurchPage.tsx`, hide the `"Livestream Virtual Sanctuary"` / `"Livestream"` configuration card when `profile?.role === 'super_admin'`.
4. **Hide Neural Pipeline UI on AI Chatbot Window**:
   - In `web/src/components/ai/ParishAssistant.tsx`, hide the `"Chat" | "Neural Pipeline"` top switcher bar so the chatbot stays in `'chat'` view only.
   - In `web/src/components/ai/ChatMessage.tsx`, hide the expandable `"Neural Core · X action(s) verified"` debug trace pill and terminal dropdown beneath assistant replies.

## Acceptance Criteria
- [x] `SuperAdminDashboard`, `PriestDashboard`, and `ChurchAdminDashboard` do not render `<DailyVerse />`; `UserDashboard` and `VolunteerDashboard` still render `<DailyVerse />`.
- [x] Opening `EditRoleModal` as `super_admin` does not show the `"Platform Ownership Transfer"` section or button.
- [x] `super_admin` can view livestreams on `/churches/:id` but never sees `<LiveBroadcastManager />`, the `"Studio Controls"` button, or the Livestream configuration card on Add/Edit Church pages; `church_admin` retains full livestream studio and edit access for their assigned church.
- [x] Opening the AI Chatbot (`ParishAssistant`) shows only the clean chat interface with no `"Neural Pipeline"` switcher tab and no `"Neural Core"` debug trace under bot messages.
- [x] `tsc -b` and `vite build` pass cleanly.
