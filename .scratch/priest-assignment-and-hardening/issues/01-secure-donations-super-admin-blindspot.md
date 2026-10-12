# Issue 01: Secure Donations Super Admin Blindspot

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Enforce strict parish financial privacy by completely cutting off `super_admin` access to parish donations in both database Row-Level Security (RLS) and the Web User Interface.

Currently in `supabase/migrations/001_initial_schema.sql`, `super_admin` is allowed to query and mutate all donations across all churches. Furthermore, `DonationsPage.tsx` allows Super Admins to view all records, totals, and payment receipts.

### Requirements:
1. **Database Migration (`034_secure_donations_super_admin_blindspot.sql`)**:
   - Drop policies on `public.donations` granting access to `super_admin`.
   - Recreate policies using `public.get_current_user_role()` and `public.get_current_user_church_id()`:
     - Donors see their own records (`auth.uid() = user_id`).
     - Parish staff (`church_admin`, `admin`) only see/update records where `church_id = public.get_current_user_church_id()`.
     - `super_admin` is strictly excluded (receives 0 rows).
   - Update Supabase Storage RLS on `donation-proofs` bucket to block `super_admin` access.
2. **Web Layout Navigation (`DashboardLayout.tsx`)**:
   - Hide the "Donations" tab from the sidebar for `super_admin`.
3. **Route Guarding (`DonationsPage.tsx`)**:
   - If user has `profile.role === 'super_admin'`, redirect to `/dashboard` with an error message: *"Parish financial records are restricted to parish administration."*
4. **Super Admin Dashboard (`SuperAdminDashboard.tsx`)**:
   - Ensure zero donation statistics, amounts, or financial graphs are displayed.

---

## 2. Acceptance Criteria
- [x] Database migration `034_secure_donations_super_admin_blindspot.sql` created and verified.
- [x] Super Admin cannot see the "Donations" link in sidebar.
- [x] Navigating to `/donations` as Super Admin redirects away or shows 403.
- [x] Direct Supabase REST queries to `donations` using a Super Admin JWT return empty array (`[]`).
- [x] `npm run dev` and `npx tsc -b` compile with 0 errors.

## 3. Comments

## 4. Resolution Details
1. **Database Migration (`034_secure_donations_super_admin_blindspot.sql`)**:
   - Dropped legacy policies on `public.donations` granting `super_admin` access.
   - Recreated strict RLS policies on `public.donations`:
     - Donors see/create their own records (`auth.uid() = user_id AND public.get_current_user_role() != 'super_admin'`).
     - Parish staff (`church_admin`, `admin`) only see/update records for their assigned church (`church_id = public.get_current_user_church_id() AND public.get_current_user_church_id() IS NOT NULL`).
     - `super_admin` is strictly excluded and receives 0 rows.
   - Secured Supabase Storage RLS policies for `donation-proofs` bucket on `storage.objects`:
     - Donors can upload, view, and delete only their own proofs.
     - Parish staff (`church_admin`, `admin`) can view proofs corresponding to their parish.
     - `super_admin` is completely blocked from all operations on `donation-proofs`.
   - Also integrated migration into `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`.

2. **Web Layout Navigation (`DashboardLayout.tsx`)**:
   - Updated sidebar navigation to hide "Donations" from `super_admin` (`profile?.role === 'super_admin'`).
   - Replaced untyped casts with a strongly typed `NavigationItem` interface.

3. **Route Guarding (`DonationsPage.tsx`)**:
   - Added guard that immediately redirects `super_admin` to `/dashboard` with notice state: *"Parish financial records are confidential and restricted to parish administration."*
   - Prevented stats and donation queries and realtime subscriptions from executing when `profile?.role === 'super_admin'`.
   - Constrained parish views strictly to assigned parish (`assigned_church_id || church_id`).

4. **Super Admin Dashboard (`SuperAdminDashboard.tsx`)**:
   - Displayed security notice banner when redirected from `/donations`.
   - Confirmed zero monetary figures, donation stats, or transaction metrics exist in the super admin dashboard view.

5. **Static Validation**:
   - Verified with `npm run build` (`tsc -b && vite build`) and `npx eslint`, passing with 0 errors.
