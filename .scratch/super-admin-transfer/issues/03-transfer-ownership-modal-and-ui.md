# 03: Transfer Ownership Modal & Users Page UI

Type: task
Status: resolved
Blocked by: 01, 02

## Summary
Implement the dedicated "Transfer Ownership" modal and integration in `UsersPage.tsx` allowing the sole Super Admin to securely transfer ownership to another user.

## Scope & Implementation Details
1. Create `web/src/components/admin/TransferOwnershipModal.tsx`:
   - Display clear, high-contrast warning banner (amber/red) explaining the irreversibility of transferring platform ownership.
   - Display target user details (name, email, current role).
   - Confirmation mechanism: User must type the target user's email or exact confirmation phrase (`TRANSFER OWNERSHIP`) to enable the confirmation button.
   - Call `supabase.rpc('transfer_super_admin', { target_user_id: user.id })`.
   - On success: Refresh profile state (`refreshProfile()`), display a success toast/alert, and redirect or refresh the `UsersPage`.
   - On error: Display descriptive error message and reset loading state.
2. Update `web/src/pages/admin/UsersPage.tsx`:
   - For rows corresponding to non-super_admin users: When logged in as `super_admin`, display a "Transfer Ownership" action button (with a Key/Shield icon).
   - For the current Super Admin's row: Highlight with a distinct "Creator / Owner" badge; disable the edit role and delete buttons.

## Acceptance Criteria
- [x] Transfer Ownership modal displays proper warnings and prevents accidental clicks with confirmation input.
- [x] Successful transfer calls the RPC function, updates profile state, and updates the UI instantly.
- [x] Visual distinction for the sole Super Admin in the users list.

## Resolution
1. Created `web/src/components/admin/TransferOwnershipModal.tsx`:
   - Added high-contrast permanent warning alerts.
   - Designated successor preview card with current role and new Platform Owner role preview.
   - Strict email confirmation matching requirement to unlock the confirmation submit button.
   - Integrated `supabase.rpc('transfer_super_admin', { target_user_id })` execution with error reporting and `refreshProfile()` trigger.
2. Updated `web/src/pages/admin/UsersPage.tsx`:
   - Added Platform Owner badge (`Crown` icon with distinct purple badge styling) for the Super Admin row.
   - Disabled "Edit Role" for the Super Admin row across Flat Table (desktop + mobile cards) and Group by Parish accordion view.
   - Added "Transfer Ownership" action button for non-super_admin user rows when accessed by the active Super Admin.
   - Integrated `TransferOwnershipModal` with live refresh and success alert notification banner.
