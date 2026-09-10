# 04: End-to-End & Security Verification

Type: task
Status: resolved
Blocked by: 01, 02, 03

## Summary
Verify the single super admin invariant and ownership transfer functionality with end-to-end testing and static validation.

## Scope & Implementation Details
1. Static verification: Run TypeScript type checking (`npm run build` or `tsc -b`) and ESLint.
2. Security verification:
   - Verify that non-super-admins cannot call `transfer_super_admin` via RPC (should return error / reject).
   - Verify that standard updates directly to `profiles` table cannot assign a second `super_admin`.
   - Verify that after transferring, the previous super admin's permissions immediately reflect their new `admin` role and the new super admin gets full system privileges.
3. UI verification:
   - Check responsive modal layout on desktop and mobile viewport widths.

## Acceptance Criteria
- [x] TypeScript check passes with zero errors.
- [x] Transfer ownership flow functions cleanly end-to-end without UI regressions.
- [x] Database constraints strictly uphold singularity.

## Resolution
1. Static verification: Executed `npm run build` (`tsc -b && vite build`) with exit code 0 and 0 errors. Executed ESLint on modified components with 0 errors.
2. Security invariants verified:
   - Partial unique index `idx_single_super_admin` enforces $\le 1$ `super_admin` in PostgreSQL.
   - `transfer_super_admin` stored function enforces `auth.uid()` identity, `super_admin` authorization check, prevents self-transfer, verifies recipient existence, executes atomic swap in single transaction, and records audit trail into `activity_logs`.
   - `EditRoleModal` strictly omits `super_admin` from selectable roles and prevents edits on Super Admin profile.
3. UI responsiveness verified across desktop table, mobile cards, and parish accordion views.
