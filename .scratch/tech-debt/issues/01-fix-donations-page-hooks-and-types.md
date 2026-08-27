# 01 - Fix DonationsPage React Hook Violations & Types

Status: ready-for-agent
Type: task
Blocked by: none

## Description
In `web/src/pages/donations/DonationsPage.tsx`:
1. Move the early return `if (profile && profile.role === 'user') return <Navigate to="/profile" replace />;` down into the render block or wrap the component in a role gate so that all hooks (`useState`, `useChurches`, `useCallback`, `useEffect`) execute in unconditional order.
2. Replace all remaining `(data as any)` and `(d as any)` casts with strict types from `web/src/lib/supabase/donations.ts`.
3. Verify ESLint passes with 0 hook warnings/errors.

## Acceptance Criteria
- Zero `react-hooks/rules-of-hooks` errors.
- Zero `as any` casts in `DonationsPage.tsx`.
- `npm --prefix web run build` passes with 0 errors.
