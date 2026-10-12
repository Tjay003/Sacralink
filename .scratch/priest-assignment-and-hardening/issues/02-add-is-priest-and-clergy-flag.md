# Issue 02: Add is_priest and Clergy Flag to Profiles

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Support both dedicated clergy accounts (`role = 'priest'`) and dual-role Priest-Administrators (`role = 'church_admin'` who is also an ordained priest).

Currently, `profiles` does not have an `is_priest` boolean column. If a priest acts as the sole administrator of his church, he needs `church_admin` administrative permissions while simultaneously being recognized as an ordained celebrant for sacrament scheduling.

### Requirements:
1. **Database Migration (`035_add_is_priest_to_profiles.sql`)**:
   - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_priest BOOLEAN DEFAULT false;`
   - Create index `idx_profiles_is_priest` on `profiles(is_priest)`.
2. **TypeScript Types (`shared/` & `web/src/types/database.ts`)**:
   - Update `Profile` interface to include `is_priest?: boolean | null`.
3. **User Management UI (`UsersPage.tsx` & `UserEditModal.tsx`)**:
   - When editing a staff member (`church_admin` or `admin`), add a toggle switch:
     **"Ordained Catholic Priest"** *(Allows this administrator to be assigned as a sacramental celebrant)*.
   - When selecting role `'priest'`, automatically default `is_priest = true`.
   - Update Supabase update call in `profiles.ts` to persist `is_priest`.

---

## 2. Acceptance Criteria
- [x] Database migration `035_add_is_priest_to_profiles.sql` created and verified.
- [x] `Profile` types updated across `web/` and `shared/`.
- [x] User Edit modal allows toggling `is_priest` for `church_admin` and `admin`.
- [x] Setting `is_priest: true` persists to Supabase `profiles` table.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Resolution Details
1. **Database Migration (`supabase/migrations/035_add_is_priest_to_profiles.sql`)**:
   - Added column `is_priest BOOLEAN DEFAULT false` to `public.profiles`.
   - Added index `idx_profiles_is_priest` on `public.profiles(is_priest)` for fast lookups.

2. **TypeScript Typings (`web/src/types/database.ts` & `shared/types.ts`)**:
   - Added `is_priest?: boolean | null` to `Profile` in `web/src/types/database.ts` (across `Row`, `Insert`, and `Update`).
   - Added `is_priest?: boolean | null` to `Profile` interface in `shared/types.ts`.

3. **Supabase & REST Profiles Client (`web/src/lib/supabase/profiles.ts` & `web/src/lib/directApi.ts`)**:
   - Exported `updateProfile(userId, updates)`, `getProfileById(userId)`, and `getChurchPriests(churchId)` in `profiles.ts`.
   - Added `is_priest?: boolean | null` to `directUpdateProfile` in `directApi.ts`.

4. **User Management UI (`EditRoleModal.tsx` & `UsersPage.tsx`)**:
   - Added `'priest'` role to `availableRoles` in `EditRoleModal`.
   - When role `'priest'` is selected, `is_priest` is automatically set to `true`.
   - Added an "Ordained Catholic Priest" toggle switch with Sacred Gold active state when editing `admin` or `church_admin` roles.
   - Subtitle clearly explains: "Allows this administrator to be assigned as a sacramental celebrant".
   - Created `web/src/components/users/UserEditModal.tsx` and `web/src/pages/users/UsersPage.tsx` re-exporting the modal and page.
   - Added clergy badges in `UsersPage.tsx` for dual-role priest-administrators in Table, Grid, and Grouped views.
   - Updated `calculateRoleStats` and `roleFilter` to count and filter ordained priests including dual-role administrators.

5. **Validation**:
   - Verified with `npx tsc -b` with 0 errors.
   - Verified production build `npm run build` (`tsc -b && vite build`) passed with exit code 0.
