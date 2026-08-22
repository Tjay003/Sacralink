# 🎭 Demo Mode Configuration

This project supports a **Demo Mode** feature flag system that allows you to hide incomplete or WIP features for client presentations while keeping all code intact for development.

## Quick Start

### Enable Demo Mode (for client presentations)
1. Open `web/.env`
2. Set `VITE_DEMO_MODE=true`
3. Restart the dev server: `npm run dev`

### Disable Demo Mode (for development)
1. Open `web/.env`
2. Set `VITE_DEMO_MODE=false` or remove the line
3. Restart the dev server: `npm run dev`

## Feature Visibility Matrix

All flags are configured in [`web/src/config/featureFlags.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/config/featureFlags.ts).

### 🚫 Hidden / Disabled in Demo Mode (`!isDemoMode`)
- ❌ **AI Parishioner Assistant** (`parishionerChatbot`) - Floating AI chatbot on church detail pages
- ❌ **AI Knowledge Base Sync** (`churchAiSync`) - Admin dashboard AI sync button & widget
- ❌ **Calendar View** (`calendar`) - Visual appointments calendar widget
- ❌ **Church Quick Links** (`churchQuickLinks`) - Church admin quick actions
- ❌ **User Quick Links** (`quickLinks`) - Parishioner dashboard quick action buttons

### 🟡 Visible with Demo Mode Restrictions
- 🟡 **System Announcements** (`systemAnnouncements`) - Always visible; action buttons disabled in demo mode
- 🟡 **Church Announcements** (`churchAnnouncements`) - Always visible; action buttons disabled in demo mode
- 🟡 **User Church Selector** (`userChurchSelector`) - Always visible; action buttons disabled in demo mode

### ✅ Always Visible Features (`enabled: true`)
- ✅ **Dashboard** - Role-based dashboard (Super Admin, Church Admin, Parishioner)
- ✅ **Churches** (`churches`) - Full CRUD operations & 360° virtual tour
- ✅ **Appointments** (`appointments`) - Book and manage sacrament appointments
- ✅ **Donations** (`donations`) - Full cashless donation verification workflow
- ✅ **User Management** (`admin`) - Admin user and role management
- ✅ **Super Admin Church Selector** (`churchSelector`) - Church selection dropdown
- ✅ **Recent Appointments Widget** (`churchRecentAppointments`) - Church admin dashboard widget
- ✅ **Upcoming Appointments Widget** (`userUpcomingAppointments`) - User dashboard widget
- ✅ **Daily Bible Verse** (`dailyVerse`) - User dashboard widget
- ✅ **Social Auth** (`socialAuth`) - Google login button
- ✅ **Profile** - User profile & avatar management

## How It Works

The feature flag system operates at three levels:
1. **Routes** - Disabled features do not register routes in [`App.tsx`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/App.tsx)
2. **Navigation** - Sidebar menu items for disabled features are filtered out in [`DashboardLayout.tsx`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/layout/DashboardLayout.tsx)
3. **Components & Widgets** - Individual components check `isFeatureEnabled('flagName')` or `isDemoMode` to conditionally render UI

## Technical Details

- **Configuration File**: [`web/src/config/featureFlags.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/config/featureFlags.ts)
- **Environment File**: `web/.env` (`VITE_DEMO_MODE=true|false`)
