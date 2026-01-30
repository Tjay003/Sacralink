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

When `VITE_DEMO_MODE=true`, the following incomplete features are hidden:

### 🚫 Hidden Features
- ❌ **Donations** - Phase 5 (not started)
- ❌ **Announcements** - Phase 6 (not started)
- ❌ **Users/Admin Management** - Admin feature (incomplete)

### ✅ Visible Features
- ✅ **Dashboard** - Fully functional
- ✅ **Churches** - Complete CRUD operations
- ✅ **Mass Schedules** - Add, edit, delete schedules
- ✅ **Appointments** - Book and manage appointments
- ✅ **Profile** - User profile management

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
