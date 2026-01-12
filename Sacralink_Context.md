# SACRALINK: Project Master Context & "Bible"
> **Version:** 2.0 | **Last Updated:** 2026-01-09  
> **Use this file as context for AI coding assistants.**

---

## 1. Project Identity

| Property | Value |
|----------|-------|
| **Title** | SACRALINK – A Cross-Platform System for Church Management |
| **Type** | Hybrid System (Web Application + Android Mobile Application) |
| **Core Goal** | Modernize parish operations in San Jose del Monte (CSJDM) by digitizing records, automating scheduling, enabling cashless donations, and providing virtual access (Livestream/360°) |
| **Target Mobile** | Android 10+ (API Level 29+) for Parishioners |
| **Target Web** | Desktop/Tablet for Admins & Super Admins (iOS users via browser) |

---

## 2. Tech Stack (Strict Enforcement)

### Monorepo Structure
```
sacralink/
├── /web          → React (Vite) + TypeScript + Tailwind CSS (Admin Dashboard)
├── /mobile       → React Native (Expo) + TypeScript + NativeWind (User App)
├── /supabase     → Database, Auth, Storage, Edge Functions
└── /shared       → Shared types, utilities, constants
```

### Frontend Web
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS v3
- **Components:** Shadcn/UI (Radix-based)
- **Icons:** Lucide React
- **Routing:** React Router DOM v6
- **State:** Zustand or React Context
- **Forms:** React Hook Form + Zod

### Frontend Mobile
- **Framework:** React Native + Expo SDK 50+
- **Styling:** NativeWind (Tailwind for RN)
- **Navigation:** React Navigation v6
- **Icons:** Lucide React Native
- **Components:** React Native Paper or custom

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Email/Password, Google OAuth)
- **Storage:** Supabase Storage
- **Functions:** Supabase Edge Functions (Deno)
- **Realtime:** Supabase Realtime (for notifications)

### Integrations
- **Maps:** Google Maps API (Web) / react-native-maps (Mobile)
- **360 Viewer:** Pannellum (Web) / WebView (Mobile)
- **Video:** YouTube/Facebook Embeds (Iframe)
- **Payments Display:** GCash/Maya QR Code images

---

## 3. Coding Rules (The "Constitution")

1. **TypeScript Only** – No `.js` files. Use interfaces for all data types.
2. **Supabase First** – Always check `Sacralink_database.sql` before writing code. Do not hallucinate column names.
3. **Authentication** – Use Supabase Auth Helpers. Never build custom auth logic.
4. **Styling** – Use Tailwind CSS utility classes. Do not create `.css` files.
5. **Icons** – Use `lucide-react` for web and `lucide-react-native` for mobile.
6. **Error Handling** – Always handle `loading` and `error` states in UI.
7. **Mobile Compatibility** – Ensure mobile code works on Android 10+ (API 29).
8. **Types First** – Define TypeScript interfaces before implementing features.

---

## 4. Database Schema (Source of Truth)

> **⚠️ IMPORTANT:** The complete schema is in `Sacralink_database.sql`. This is a summary.

### Enums
```typescript
type UserRole = 'super_admin' | 'admin' | 'priest' | 'volunteer' | 'user';
type ApptStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';
type SacramentType = 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
type DonationStatus = 'pending' | 'verified' | 'rejected';
```

### Tables Overview

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts (extends auth.users) |
| `churches` | Parish information, location, settings |
| `mass_schedules` | Weekly mass schedule per church |
| `priest_availability` | Priest calendar for AI scheduler |
| `service_durations` | How long each sacrament takes |
| `appointments` | Booking requests (core feature) |
| `sacrament_requirements` | Required documents per service |
| `appointment_documents` | User-uploaded documents |
| `donations` | Cashless donation records |
| `announcements` | Parish news/updates |
| `activity_logs` | Audit trail |

### Key Relationships
```
profiles.church_id → churches.id
appointments.user_id → profiles.id
appointments.church_id → churches.id
appointments.priest_id → profiles.id
donations.user_id → profiles.id
donations.church_id → churches.id
```

---

## 5. Key Features & Logic

### A. The "AI" Scheduler

> **Note:** This is NOT a generative LLM. It is a **Deterministic Logic Agent**.

**Full Logic Flow:**
1. User selects `Date/Time` + `Service Type` + `Church`
2. System checks:
   - ✅ Is church **OPEN** at that time? → Check `churches.operating_hours`
   - ✅ Is there a **PRIEST available**? → Check `priest_availability` table
   - ✅ Is the slot **FREE**? → Check `appointments` for conflicts
   - ✅ Does the service **FIT**? → Check `service_durations` for overlap
3. **IF** any check fails → Find next available slot
4. **Output:** Modal displays suggestion or confirmation

**Database Query Logic:**
```sql
-- Check for conflicts
SELECT * FROM appointments 
WHERE church_id = :church_id 
  AND status NOT IN ('cancelled', 'rejected')
  AND requested_date < :end_time 
  AND end_time > :requested_date;
```

---

### B. 360° Virtual Tour

| Platform | Implementation |
|----------|----------------|
| **Web** | `pannellum-react` component renders equirectangular JPG |
| **Mobile** | `WebView` pointing to hosted Pannellum viewer |

**Storage:** Supabase bucket `panoramas/` (public, max 10MB)

---

### C. Cashless Donation

**User Flow:**
1. User views Church's QR Code (GCash/Maya) in app
2. User saves image → Opens GCash → Pays → Takes Screenshot
3. User returns to App → Uploads Screenshot + Reference Number
4. Admin Dashboard → Sees "Pending" → Verifies manually → Approves/Rejects

**Database:** `donations` table with `status` enum and `proof_url`

---

### D. Livestreaming

**Implementation:** Do NOT build a streaming server.
- **Admin:** Pastes YouTube/Facebook Live URL into Dashboard
- **User:** App embeds video player via iframe/WebView
- **Storage:** Just `churches.livestream_url` text field

---

## 6. Design System

### Colors (Tailwind Config)
```javascript
colors: {
  primary: '#2563EB',    // Faith Blue - Trust/Connection
  secondary: '#64748B',  // Stone Gray - Structure
  accent: '#F59E0B',     // Sacred Gold - Highlights/Action
  success: '#10B981',    // Verified/Approved
  destructive: '#EF4444', // Errors/Delete
  background: '#F8FAFC', // Slate-50 - Clean light mode
  foreground: '#0F172A', // Slate-900 - Text
}
```

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Bold/SemiBold
- **Body:** Regular, 16px base

### Design Principles
- Clean, Accessible (High Contrast)
- Solemn & Professional
- "Apple meets The Vatican" aesthetic

---

## 7. User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | Create churches, approve admin accounts, view global stats, manage all data |
| **Parish Admin** | Manage their specific church (schedules, donations, announcements, priests) |
| **Priest** | View personal schedule, view assigned appointments |
| **Volunteer** | Help with livestream setup, manage announcements |
| **User (Parishioner)** | View/search churches, book appointments, donate, watch stream, 360 tour |

---

## 8. Storage Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `avatars` | Public | User profile pictures |
| `panoramas` | Public | 360° church images |
| `donation-qr` | Public | Church QR code images |
| `donation-proofs` | Private | User payment screenshots |
| `announcements` | Public | Announcement images |
| `documents` | Private | Appointment requirement uploads |

---

## 9. Edge Functions (Supabase)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `on-user-signup` | Auth trigger | Auto-create profile row |
| `check-availability` | HTTP POST | AI scheduler slot checking |
| `send-notification` | HTTP POST | Push notification via FCM |
| `cleanup-expired` | Cron (daily) | Archive old appointments |

---

## 10. Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Setup monorepo structure
- [ ] Configure Supabase project
- [ ] Run database migrations
- [ ] Setup authentication context
- [ ] Create shared TypeScript types

### Phase 2: Web Admin Dashboard (Week 3-5)
- [ ] Auth pages (Login/Register)
- [ ] Dashboard layout
- [ ] Church CRUD
- [ ] Mass schedule management
- [ ] Priest management
- [ ] Appointment management
- [ ] Donation verification
- [ ] Announcement management

### Phase 3: Mobile App (Week 6-8)
- [ ] Auth screens
- [ ] Church listing & search
- [ ] Church detail (360°, Livestream)
- [ ] Appointment booking with AI suggestions
- [ ] Donation upload
- [ ] Announcements feed
- [ ] User profile

### Phase 4: Integration & Polish (Week 9-10)
- [ ] AI scheduler Edge Function
- [ ] Push notifications
- [ ] Testing & bug fixes
- [ ] Performance optimization

---

## 11. File Structure Reference

```
sacralink/
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   ├── types/
│   │   │   └── database.ts
│   │   └── App.tsx
│   ├── tailwind.config.js
│   └── package.json
│
├── mobile/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   └── supabase.ts
│   ├── types/
│   └── app.json
│
├── supabase/
│   ├── migrations/
│   │   └── Sacralink_database.sql
│   └── functions/
│       ├── check-availability/
│       └── send-notification/
│
└── shared/
    ├── types.ts
    └── constants.ts
```

---

**END OF CONTEXT**