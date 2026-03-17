# 🎭 Demo Mode Configuration

This project supports a **Demo Mode** feature flag system that allows you to hide incomplete features for client presentations while keeping all code intact for development.

## Quick Start

### Enable Demo Mode (for client presentations)
1. Open `web/.env`
2. Set `VITE_DEMO_MODE=true`
3. Restart the dev server: `npm run dev`

### Disable Demo Mode (for development)
1. Open `web/.env`
2. Set `VITE_DEMO_MODE=false` or remove the line
3. Restart the dev server: `npm run dev`

## What Gets Hidden in Demo Mode

When `VITE_DEMO_MODE=true`, the following features are hidden (controlled via `featureFlags.ts`):

### 🚫 Hidden Features (in Demo Mode)
- ❌ **Donations** - Cashless donation verification system
- ❌ **Calendar View** - Visual appointment calendar
- ❌ **Church Selector** - Super Admin church dropdown
- ❌ **Church Quick Links** - Church admin quick actions
- ❌ **Recent Appointments** - Church admin dashboard widget
- ❌ **Quick Links** - User dashboard quick actions
- ❌ **Upcoming Appointments** - User dashboard widget
- ❌ **Social Auth Buttons** - Google & Facebook login buttons

### ✅ Always Visible Features
- ✅ **Dashboard** - Role-based dashboard (all roles)
- ✅ **Churches** - Full CRUD operations
- ✅ **Mass Schedules** - Add, edit, delete schedules
- ✅ **Appointments** - Book and manage sacrament appointments
- ✅ **Announcements** - Parish announcements management
- ✅ **User Management** - Admin user & role management
- ✅ **Profile** - User profile & avatar management
- ✅ **System Announcements** - Super admin broadcasts
- ✅ **Daily Bible Verse** - User dashboard widget

## How It Works

The feature flag system works at three levels:

1. **Routes** - Disabled features don't register routes (users can't access them via URL)
2. **Navigation** - Menu items for disabled features are hidden from the sidebar
3. **Configuration** - All flags are centralized in `src/config/featureFlags.ts`

## For Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Add `VITE_DEMO_MODE=true` to your environment variables in the hosting platform
2. Deploy as normal
3. Your client will only see completed features

## Technical Details

- **Config file**: `web/src/config/featureFlags.ts`
- **Modified files**: 
  - `web/src/App.tsx` - Route protection
  - `web/src/components/layout/DashboardLayout.tsx` - Navigation filtering
  - `web/.env` - Environment configuration

---

**Note**: This is a development feature, not production security. For actual feature access control, use proper role-based permissions.
