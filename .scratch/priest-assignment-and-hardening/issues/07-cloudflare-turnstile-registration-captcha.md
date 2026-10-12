# Issue 07: Cloudflare Turnstile Registration CAPTCHA

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Protect the SacraLink platform from bot account generation by implementing **Cloudflare Turnstile** on the user registration page.

Cloudflare Turnstile provides frictionless, puzzle-free CAPTCHA verification without frustrating users or violating privacy.

### Requirements:
1. **Turnstile Package or Script Integration**:
   - Install `@marsidev/react-turnstile` (or embed Cloudflare Turnstile script component).
   - Add `VITE_TURNSTILE_SITE_KEY` to `web/.env.example` and `web/.env` (support testing mode with Cloudflare's official dummy test keys: `1x00000000000000000000AA` which always passes).
2. **Registration Integration (`RegisterPage.tsx`)**:
   - Place Turnstile widget directly above the "Create Account" submit button.
   - Maintain `turnstileToken` state.
   - Disable submission until Turnstile verification token is received.
   - If `isDemoMode` is enabled or `VITE_TURNSTILE_SITE_KEY` is omitted, bypass gracefully so development and live client demos remain uninterrupted.
3. **UX & Accessibility**:
   - Maintain SacraLink clean light-mode styling (`bg-white border-border rounded-xl`).
   - Clear loading feedback during verification.

---

## 2. Acceptance Criteria
- [x] Turnstile widget renders cleanly on `RegisterPage.tsx`.
- [x] Registration form cannot be submitted without completing CAPTCHA verification.
- [x] Test key `1x00000000000000000000AA` passes and allows registration.
- [x] In demo mode or if site key is absent, registration functions without breaking.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Comments

## 4. Resolution Details
1. **Turnstile Widget (`web/src/components/common/TurnstileWidget.tsx`)**:
   - Created a clean, dependency-free React component integrating Cloudflare's Turnstile explicit script API (`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`).
   - Manages asynchronous script loading, lifecycle hooks (`onVerify`, `onError`, `onExpire`), themes (`light`, `dark`, `auto`), and unmount cleanup via `window.turnstile.remove(widgetId)`.
   - Uses callback refs to prevent unnecessary widget re-renders during form input changes.
   - Features built-in pass-through when `isDemoMode` is enabled, in test environments, or when the site key is absent.

2. **Environment Configuration**:
   - Added `VITE_TURNSTILE_SITE_KEY` to `web/.env` and `web/.env.example`.
   - Defaults to Cloudflare's official testing dummy site key `1x00000000000000000000AA` (which always automatically passes in local environments).

3. **User Registration Integration (`web/src/pages/auth/RegisterPage.tsx`)**:
   - Positioned `TurnstileWidget` directly above the "Create Account" submit button.
   - Maintained `turnstileToken` state in `RegisterPage`.
   - Disabled the submit button until Turnstile verification completes (unless `isDemoMode` is active).
   - Enforced security check within `onSubmit` handler and passed `turnstileToken` to `signUp`.

4. **Auth Layer Support (`web/src/contexts/AuthContext.tsx` & `web/src/lib/supabase.ts`)**:
   - Updated `signUp` signature and implementation to optionally pass `captchaToken` into Supabase auth options.

5. **Static Validation**:
   - `npx tsc -b` executed in `web/` with 0 errors.
   - `npm run build` executed in `web/` compiling cleanly in 11.99s.
