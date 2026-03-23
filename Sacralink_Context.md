# SACRALINK: Project Master Context & "Bible"
> **Version:** 3.0 | **Last Updated:** 2026-03-20
> **Use this file as context for AI coding assistants. Read this file FIRST before touching any code.**

---

## 1. Project Identity

| Property | Value |
|----------|-------|
| **Title** | SACRALINK – A Cross-Platform System for Church Management |
| **Type** | Hybrid System (Web Admin Dashboard + Android Mobile App) |
| **Core Goal** | Modernize parish operations in San Jose del Monte (CSJDM) — digitize records, automate sacrament scheduling, enable cashless donations, and provide virtual church access (360° tour, Livestream) |
| **Target Web** | Desktop/Tablet for Admins & Super Admins (also accessible on iOS via browser) |
| **Target Mobile** | Android 10+ (API Level 29+) for Parishioners — **not yet built** |

---

## 2. Monorepo Structure

```
sacralink/
├── /web          → React (Vite) + TypeScript + Tailwind CSS v4 (Admin Dashboard) ← ACTIVE
├── /mobile       → React Native (Expo) + TypeScript + NativeWind (User App) ← NOT STARTED
├── /supabase     → Database migrations & Edge Functions
└── /shared       → Shared TypeScript types & constants
```

---

## 3. Tech Stack

### Frontend Web (`/web`)

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Language | TypeScript | 5.x |
| Styling | **Tailwind CSS v4** | 4.x |
| Components | Shadcn/UI (Radix-based) | Custom |
| Icons | Lucide React | 0.562.x |
| Routing | React Router DOM | 7.x |
| State | React Context (AuthContext) | — |
| Forms | React Hook Form + Zod | — |
| Animation | Framer Motion | 12.x |
| Dates | date-fns | 4.x |
| Image Compression | browser-image-compression | 2.x |

### Backend (Supabase)

| Service | Purpose |
|---------|---------|
| PostgreSQL | Main database |
| Supabase Auth | Email/Password + Google OAuth + Facebook OAuth |
| Supabase Storage | Images, documents, avatars |
| Supabase Realtime | Real-time notifications |
| Supabase Edge Functions | Serverless logic (Deno) |

---

## 4. Coding Rules (MANDATORY — Do Not Break These)

1. **TypeScript Only** – No `.js` files. Use interfaces for all data models.
2. **Supabase First** – Always check `Sacralink_database.sql` before writing queries. Never guess column names.
3. **Tailwind v4** – Use utility classes only. Do NOT write `.css` files. Note: Tailwind v4 uses `@import "tailwindcss"` not `@tailwind` directives.
4. **Icons** – `lucide-react` for web. `lucide-react-native` for mobile.
5. **Error Handling** – Always handle `loading` and `error` states in UI.
6. **Authentication** – Use `useAuth()` hook (AuthContext). Never build custom auth logic.
7. **Types First** – Define TypeScript interfaces before implementing features.
8. **No Settings Page** – The Settings page has been removed. Do not re-add it or link to `/settings`.

---

## 5. Routes (Web App)

All authenticated routes are nested under `DashboardLayout`. Auth is handled by `AuthContext`.

| Path | Component | Access |
|------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public |
| `/privacy` | `PrivacyPage` | Public |
| `/dashboard` | `DashboardPage` (role-aware) | All roles |
| `/profile` | `ProfilePage` | All roles |
| `/churches` | `ChurchesPage` | All roles |
| `/churches/add` | `AddChurchPage` | Admin+ |
| `/churches/:id` | `ChurchDetailPage` | All roles |
| `/churches/:id/edit` | `EditChurchPage` | Admin+ |
| `/churches/:id/book` | `BookAppointmentPage` | All roles |
| `/appointments` | `AppointmentsPage` | All roles |
| `/donations` | `DonationsPage` | Admin+ (feature flagged) |
| `/users` | `UsersPage` | Admin+ (feature flagged) |
| `/admin/system-announcements` | `SystemAnnouncementsPage` | Super Admin only |

---

## 6. Role-Based Access

| Role | Access Level |
|------|-------------|
| `super_admin` | Everything — users, churches, global stats, system announcements |
| `admin` | Church management, appointments, donations, announcements for their church |
| `church_admin` | Same as admin but specific to one church |
| `priest` | View personal schedule and assigned appointments |
| `volunteer` | Help with announcements, limited access |
| `user` | Parishioner — view churches, book appointments, donate, see announcements |

---

## 7. Dashboard Views (Role-Based)

`DashboardPage.tsx` renders different sub-components based on role:

- `SuperAdminDashboard.tsx` → `super_admin` role
- `ChurchAdminDashboard.tsx` → `admin`, `church_admin` roles
- `UserDashboard.tsx` → `user`, `volunteer` roles

---

## 8. Feature Flags (`/web/src/config/featureFlags.ts`)

**Controlled by** `VITE_DEMO_MODE=true` in `.env`. When demo mode is ON, incomplete features are hidden.

| Flag | Always On | Demo Mode Behavior |
|------|-----------|-------------------|
| `systemAnnouncements` | ✅ | Visible, buttons disabled |
| `churchAnnouncements` | ✅ | Visible, buttons disabled |
| `churches` | ✅ | Always visible |
| `admin` | ✅ | Always enabled |
| `dailyVerse` | ✅ | Always shown |
| `churchSelector` | ❌ | Hidden in demo |
| `appointments` | ❌ | Hidden in demo |
| `donations` | ❌ | Hidden in demo |
| `calendar` | ❌ | Hidden in demo |
| `quickLinks` | ❌ | Hidden in demo |
| `socialAuth` | ❌ | Google/FB login hidden in demo |

---

## 9. Database Schema Summary

> **Full schema:** `supabase/migrations/Sacralink_database.sql`

### Enums
```typescript
type UserRole = 'super_admin' | 'admin' | 'church_admin' | 'priest' | 'volunteer' | 'user';
type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';
type SacramentType = 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
type DonationStatus = 'pending' | 'verified' | 'rejected';
```

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts (extends `auth.users`) — has `avatar_url`, `phone_number`, `role`, `church_id` |
| `churches` | Parish info — name, location, `livestream_url`, `operating_hours`, QR codes |
| `mass_schedules` | Weekly mass timetable per church |
| `priest_availability` | Priest calendar for scheduling |
| `service_durations` | How long each sacrament type takes |
| `appointments` | Sacrament booking requests (core feature) |
| `sacrament_requirements` | Required documents per sacrament |
| `appointment_documents` | Uploaded user documents |
| `donations` | Cashless donation records with `proof_url` and `status` |
| `announcements` | Church and system-wide announcements |
| `notifications` | In-app notification records (shown via `NotificationBell` in header) |
| `activity_logs` | Audit trail |

### Key Relationships
```
profiles.church_id        → churches.id
appointments.user_id      → profiles.id
appointments.church_id    → churches.id
appointments.priest_id    → profiles.id
donations.user_id         → profiles.id
donations.church_id       → churches.id
announcements.church_id   → churches.id  (NULL = system-wide)
notifications.user_id     → profiles.id
```

---

## 10. Storage Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `avatars` | Public | User profile photos (max 512KB, compressed client-side to ~200KB) |
| `panoramas` | Public | 360° church interior images (max 10MB) |
| `donation-qr` | Public | Church GCash/Maya QR codes |
| `donation-proofs` | Private | User payment screenshots |
| `announcements` | Public | Announcement media images |
| `documents` | Private | Sacrament requirement uploads (birth certs, etc.) |

---

## 11. Key Features & Logic

### A. Scheduling (Deterministic Logic, NOT LLM)
1. User picks Date/Time + Sacrament + Church
2. System checks: church open hours → priest availability → slot conflicts → service duration fit
3. If unavailable → finds and suggests next available slot
4. Output shown as modal with confirmation

### B. Cashless Donation Flow
1. User views church QR code (GCash/Maya) on Church Detail page
2. User pays via GCash app → takes screenshot
3. User uploads screenshot + reference number
4. Admin sees "Pending" in Donations tab → verifies → Approves/Rejects

### C. Livestreaming
- **No streaming server.** Admin pastes a YouTube/Facebook Live URL into the church record.
- Mobile app/web embeds it via iframe. Stored as `churches.livestream_url`.

### D. 360° Virtual Tour
- Web: `react-photo-sphere-viewer` renders equirectangular JPG from `panoramas` bucket
- Mobile (future): WebView pointing to hosted viewer

### E. System Announcements
- Created by `super_admin` via `/admin/system-announcements`
- Displayed as a **banner** on top of authenticated pages via `SystemAnnouncementsBanner.tsx`
- Also shows in the User Dashboard announcements section

### F. Avatar Upload
- Client-side compressed to ~200KB via `browser-image-compression` before upload
- Stored at `avatars/{user_id}/avatar.jpg` (upsert — overwrites old file)
- URL cached-busted with `?t={timestamp}` to force browser refresh
- Managed in `lib/supabase/profiles.ts` via `uploadAvatar()` / `deleteAvatar()`

### G. Notifications
- Stored in `notifications` table (Supabase Realtime)
- Shown via `NotificationBell` icon in the top-right header
- Clicking the bell opens a dropdown with notification list

---

## 12. Key Components & Files

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Global auth state, `useAuth()` hook, `profile`, `session`, `refreshProfile()` |
| `src/config/featureFlags.ts` | Feature flags + demo mode config |
| `src/components/layout/DashboardLayout.tsx` | Sidebar nav, top header, notification bell, user menu |
| `src/lib/supabase/profiles.ts` | `uploadAvatar()`, `deleteAvatar()`, `getCurrentProfile()` |
| `src/lib/supabase/donations.ts` | Donation CRUD and verification |
| `src/lib/supabase/notifications.ts` | Notification fetching and marking as read |
| `src/components/profile/AvatarUpload.tsx` | Avatar photo upload/remove UI component |
| `src/components/profile/ChangePasswordModal.tsx` | Password change modal (Supabase Auth) |
| `src/components/notifications/NotificationBell.tsx` | Notification bell icon + dropdown |
| `src/components/announcements/SystemAnnouncementsBanner.tsx` | App-wide announcement banner |
| `shared/constants.ts` | Shared constants (used by both web & mobile) |

---

## 13. Development Status

### ✅ Web App — Completed
- [x] Auth (Login, Register, Google OAuth, Facebook OAuth)
- [x] Dashboard — role-based (Super Admin, Church Admin, User views)
- [x] Churches — full CRUD (list, detail, add, edit, 360° viewer)
- [x] Mass schedule management per church
- [x] Church announcements (per-church, shown in Church Detail page)
- [x] Appointment booking with priest availability check
- [x] Appointment management (approve, reject, status updates)
- [x] Sacrament requirements & document uploads
- [x] Donations — cashless verification flow (full admin workflow)
- [x] User/Admin management (Super Admin)
- [x] System Announcements (Super Admin) — shown as banner
- [x] Notifications (in-app bell with dropdown)
- [x] Profile page — edit name, phone, avatar upload, change password
- [x] Feature flags system with demo mode
- [x] Responsive design (mobile-friendly cards on Churches, Users tabs)

### 🔴 Not Yet Built (Mobile App)
- [ ] All of `/mobile` — React Native + Expo
- [ ] Parishioner auth screens
- [ ] Church listing & search
- [ ] Church detail (360°, Livestream)
- [ ] Appointment booking with AI suggestions
- [ ] Donation upload (screenshot + reference #)
- [ ] Announcements feed
- [ ] User profile & avatar

---

## 14. Environment Variables

```env
# /web/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=false       # Set to true to hide incomplete features for demos
```

---

## 15. Design System

### Color Palette
```javascript
primary:     '#2563EB'  // Faith Blue — trust, connection
secondary:   '#64748B'  // Stone Gray — structure
accent:      '#F59E0B'  // Sacred Gold — highlights, CTAs
success:     '#10B981'  // Emerald — verified/approved
destructive: '#EF4444'  // Red — errors/delete
background:  '#F8FAFC'  // Slate-50 — clean light mode
foreground:  '#0F172A'  // Slate-900 — text
```

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Bold / SemiBold
- **Body:** Regular, 16px base

### Design Principles
- Clean, accessible, high-contrast
- Solemn and professional ("Apple meets The Vatican")
- Consistent card-based layout with `card` class
- Mobile-first responsive using Tailwind breakpoints

---

**END OF CONTEXT**