# SACRALINK - Tech Stack & Page Documentation

> **Version:** 1.0  
> **Last Updated:** 2026-02-07  
> **Project:** Church Management & Sacrament Booking System

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Page Documentation](#page-documentation)
5. [Component Architecture](#component-architecture)
6. [Database Schema](#database-schema)
7. [Feature Flags & Configuration](#feature-flags--configuration)
8. [Authentication & Authorization](#authentication--authorization)
9. [Key Features](#key-features)

---

## Project Overview

**SACRALINK** is a hybrid cross-platform system designed to modernize parish operations in San Jose del Monte (CSJDM). The system digitizes church records, automates sacrament scheduling, enables cashless donations, and provides virtual church access through 360° tours and livestreaming.

### Platform Targets
- **Web Application**: Desktop/Tablet for Admins & Super Admins (also accessible via iOS browsers)
- **Mobile Application**: Android 10+ (API Level 29+) for Parishioners
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)

---

## Technology Stack

### 📦 Monorepo Structure

```
sacralink/
├── /web          → React (Vite) + TypeScript + Tailwind CSS (Admin Dashboard)
├── /mobile       → React Native (Expo) + TypeScript + NativeWind (User App)
├── /supabase     → Database, Auth, Storage, Edge Functions
└── /shared       → Shared types, utilities, constants
```

### 🎨 Frontend Web (Admin Dashboard)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Core Framework** | React | 19.2.0 | UI component library |
| **Build Tool** | Vite | 7.2.4 | Fast development server & bundler |
| **Language** | TypeScript | 5.9.3 | Type-safe JavaScript |
| **Styling** | Tailwind CSS | 4.1.18 | Utility-first CSS framework |
| **Component Library** | Radix UI | Various | Accessible component primitives |
| **UI Components** | Shadcn/UI | Custom | Pre-built Radix-based components |
| **Icons** | Lucide React | 0.562.0 | Icon library |
| **Routing** | React Router DOM | 7.12.0 | Client-side routing |
| **State Management** | Zustand | 5.0.9 | Lightweight state management |
| **Form Handling** | React Hook Form | 7.70.0 | Performant form library |
| **Validation** | Zod | 4.3.5 | TypeScript-first schema validation |
| **Animation** | Framer Motion | 12.26.2 | Animation library |
| **Date Utilities** | date-fns | 4.1.0 | Date manipulation library |
| **Calendar** | React Calendar | 6.0.0 | Calendar component |
| **360° Viewer** | react-photo-sphere-viewer | 6.2.3 | 360° panoramic image viewer |
| **Image Compression** | browser-image-compression | 2.0.2 | Client-side image optimization |

### 🔧 Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **ESLint** | 9.39.1 | Code linting |
| **PostCSS** | 8.5.6 | CSS transformations |
| **Autoprefixer** | 10.4.23 | CSS vendor prefixing |

### 🗄️ Backend (Supabase)

| Service | Technology | Purpose |
|---------|-----------|---------|
| **Database** | PostgreSQL | Relational database |
| **Authentication** | Supabase Auth | Email/Password, OAuth (Google) |
| **File Storage** | Supabase Storage | Image & document storage |
| **Realtime** | Supabase Realtime | Real-time subscriptions |
| **Functions** | Supabase Edge Functions (Deno) | Serverless functions |
| **API** | @supabase/supabase-js | 2.90.1 | JavaScript client |
| **Auth Helpers** | @supabase/auth-helpers-react | 0.15.0 | React auth utilities |

### 🎨 Design System

#### Color Palette
```javascript
colors: {
  primary: '#2563EB',      // Faith Blue - Trust/Connection
  secondary: '#64748B',    // Stone Gray - Structure
  accent: '#F59E0B',       // Sacred Gold - Highlights/Action
  success: '#10B981',      // Verified/Approved
  destructive: '#EF4444',  // Errors/Delete
  background: '#F8FAFC',   // Slate-50 - Clean light mode
  foreground: '#0F172A',   // Slate-900 - Text
}
```

#### Typography
- **Font Family**: Inter (Google Fonts)
- **Font Weights**: Regular (400), Medium (500), SemiBold (600), Bold (700)
- **Base Size**: 16px

#### Design Philosophy
- **Clean & Accessible**: High contrast for readability
- **Solemn & Professional**: Reflects the sacred nature of the application
- **Modern Aesthetic**: "Apple meets The Vatican" design approach

---

## Project Structure

### Web Application Directory Structure

```
web/
├── src/
│   ├── assets/              # Static assets (images, logos)
│   │   └── logo.png        # SacraLink logo
│   │
│   ├── components/          # Reusable React components
│   │   ├── admin/          # Admin-specific components
│   │   │   └── EditRoleModal.tsx
│   │   ├── auth/           # Authentication components
│   │   │   ├── AuthLayout.tsx
│   │   │   └── AuthTabs.tsx
│   │   ├── churches/       # Church-related components
│   │   │   ├── EditScheduleModal.tsx
│   │   │   └── ImageLightbox.tsx
│   │   ├── dashboard/      # Dashboard widgets
│   │   │   └── DailyVerse.tsx
│   │   ├── documents/      # Document handling
│   │   │   ├── DocumentUploader.tsx
│   │   │   └── DocumentViewerModal.tsx
│   │   ├── layout/         # Layout components
│   │   │   └── DashboardLayout.tsx
│   │   ├── notifications/  # Notification components
│   │   ├── profile/        # Profile components
│   │   │   └── AvatarUpload.tsx
│   │   ├── social/         # Social media integration
│   │   │   └── FacebookFeed.tsx
│   │   └── ui/             # UI primitives (Shadcn)
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── card.tsx
│   │       ├── label.tsx
│   │       └── slot.tsx
│   │
│   ├── config/             # Configuration files
│   │   ├── featureFlags.ts # Feature toggle system
│   │   └── mockData.ts     # Mock data for demos
│   │
│   ├── contexts/           # React Context providers
│   │   └── AuthContext.tsx # Authentication state management
│   │
│   ├── hooks/              # Custom React hooks
│   │   └── useChurches.tsx # Church data fetching hook
│   │
│   ├── lib/                # Utility libraries
│   │   ├── supabase.ts     # Supabase client initialization
│   │   ├── directApi.ts    # Direct database API calls
│   │   └── supabase/       # Supabase service modules
│   │       ├── profiles.ts
│   │       └── notifications.ts
│   │
│   ├── pages/              # Page components (routes)
│   │   ├── admin/          # Admin pages
│   │   │   └── UsersPage.tsx
│   │   ├── announcements/  # Announcements pages
│   │   │   └── AnnouncementsPage.tsx
│   │   ├── appointments/   # Appointment pages
│   │   │   ├── AppointmentsPage.tsx
│   │   │   └── BookAppointmentPage.tsx
│   │   ├── auth/           # Authentication pages
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── churches/       # Church pages
│   │   │   ├── ChurchesPage.tsx
│   │   │   ├── AddChurchPage.tsx
│   │   │   ├── ChurchDetailPage.tsx
│   │   │   └── EditChurchPage.tsx
│   │   ├── dashboard/      # Dashboard pages
│   │   │   ├── DashboardPage.tsx
│   │   │   └── UserDashboard.tsx
│   │   ├── donations/      # Donation pages
│   │   │   └── DonationsPage.tsx
│   │   ├── profile/        # Profile pages
│   │   │   └── ProfilePage.tsx
│   │   └── ProfilePage.tsx # User profile (root level)
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── database.ts     # Database schema types
│   │
│   ├── App.css             # Global app styles
│   ├── App.tsx             # Main app component with routing
│   ├── index.css           # Global CSS & Tailwind imports
│   └── main.tsx            # Application entry point
│
├── public/                 # Public static files
├── .env                    # Environment variables
├── index.html              # HTML entry point
├── package.json            # Dependencies & scripts
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── vercel.json             # Deployment configuration

supabase/
├── migrations/             # Database migrations
│   ├── 000_drop_all.sql
│   ├── 001_initial_schema.sql
│   ├── 002_fix_rls_recursion.sql
│   ├── 003_enable_rls_profiles.sql
│   ├── 004_enable_rls_all_tables.sql
│   ├── 005_disable_rls_temp.sql
│   ├── 006_set_default_user_role.sql
│   ├── 007_update_mass_schedules.sql
│   ├── 008_create_appointments.sql
│   ├── 009_create_sacrament_requirements.sql
│   ├── 010_add_church_admin.sql
│   ├── 011_add_volunteer_role.sql
│   ├── 012_add_volunteer_access.sql
│   ├── 013_add_facebook_url.sql
│   ├── 014_update_requirements_schema.sql
│   ├── 016_create_church_images_table.sql
│   ├── 017_create_notifications_table.sql
│   └── 018_create_avatars_storage.sql
│
└── functions/              # Edge Functions
    ├── check-availability/ # AI scheduler logic
    └── send-notification/  # Push notifications
```

---

## Page Documentation

### 🔐 Authentication Pages

#### LoginPage (`/login`)
**File**: `src/pages/auth/LoginPage.tsx`

**Purpose**: User authentication entry point

**Features**:
- Email & password authentication
- Form validation using React Hook Form & Zod
- Password visibility toggle
- Error handling with user-friendly messages
- Animated transitions using Framer Motion
- Responsive design with AuthLayout
- Auto-redirect to dashboard on successful login

**User Flow**:
1. User enters email and password
2. Form validates input fields
3. Calls `signIn()` from AuthContext
4. On success → Navigate to `/dashboard`
5. On error → Display error message

**Technical Details**:
- Uses `useAuth()` hook for authentication state
- Schema validation with Zod
- Loading states during submission
- SacraLink branding and logo display

---

#### RegisterPage (`/register`)
**File**: `src/pages/auth/RegisterPage.tsx`

**Purpose**: New user account creation

**Features**:
- Multi-field registration form (name, email, password, contact)
- Password strength validation
- Form validation with Zod schemas
- Auto-login after successful registration
- Terms of service acceptance

**User Flow**:
1. User fills registration form
2. Validation checks all fields
3. Creates account via Supabase Auth
4. Auto-creates profile in `profiles` table
5. Redirects to dashboard

---

### 📊 Dashboard Pages

#### DashboardPage (`/dashboard`)
**File**: `src/pages/dashboard/DashboardPage.tsx`

**Purpose**: Main administrative dashboard with role-based content

**Features**:
- **Role-Based Rendering**:
  - Regular users (`user` role) → Redirected to UserDashboard
  - Admins & Super Admins → Full admin dashboard with analytics
  
- **Admin Dashboard Components**:
  - **Statistics Cards**:
    - Total Users count
    - Total Churches count
    - Pending Requests count
    - Upcoming Appointments count with trend indicators
  
  - **Quick Actions Grid** (when `dashboardConfig.showQuickActions` is enabled):
    - "View All Churches" → Navigate to churches page
    - "Manage Appointments" → Navigate to appointments page
    - "User Management" → Navigate to users page (admin only)
    - "View Reports" → Future analytics feature
  
  - **Upcoming Events Timeline**:
    - Displays scheduled appointments
    - Shows appointment details (user, church, service type)
    - Date/time information
    - Visual timeline layout

- **Demo Mode Support**:
  - Uses mock data when `VITE_DEMO_MODE=true`
  - Real Supabase queries in development mode

**Data Sources**:
- `profiles` table → User count
- `churches` table → Church count
- `appointments` table → Appointments & pending requests

**User Roles Access**:
- ✅ Super Admin - Full access
- ✅ Admin - Full access to their church's data
- ✅ User - Redirected to UserDashboard
- ✅ Volunteer - Limited view

---

#### UserDashboard (`/dashboard` for regular users)
**File**: `src/pages/dashboard/UserDashboard.tsx`

**Purpose**: Simplified dashboard for parishioners

**Features**:
- Welcome message with user's name
- Daily Bible verse widget
- Quick navigation to:
  - Browse churches
  - Book appointments
  - View personal appointments
- Personalized content based on user profile

---

### 🏛️ Church Management Pages

#### ChurchesPage (`/churches`)
**File**: `src/pages/churches/ChurchesPage.tsx`

**Purpose**: List and manage all registered churches

**Features**:
- **Church Listing Table**:
  - Church name, address, contact info display
  - Search functionality by church name
  - Grid/Card view of all churches
  
- **Actions**:
  - "Add New Church" button (admin/super_admin only)
  - View details (click on church)
  - Edit church (if user has permission)
  - Delete church (with confirmation)

- **Permission Checks**:
  - Super Admin → Can manage all churches
  - Church Admin → Can only manage their assigned church
  - Regular users → View only

**Technical Details**:
- Uses `useChurches()` custom hook for data fetching
- Real-time updates via Supabase subscriptions
- Loading & error states
- Responsive grid layout

---

#### ChurchDetailPage (`/churches/:id`)
**File**: `src/pages/churches/ChurchDetailPage.tsx`

**Purpose**: Detailed view of a single church with all information

**Features**:
- **Church Information Display**:
  - Name, description, address
  - Contact details (phone, email)
  - Operating hours
  - Map location (Google Maps integration)
  
- **Mass Schedules Section**:
  - Weekly mass schedule organized by day
  - Time formatting (12-hour format)
  - Add/Edit/Delete schedule functionality
  - Modal-based schedule editor
  
- **Visual Content**:
  - **360° Virtual Tour**:
    - Interactive panoramic view using ReactPhotoSphereViewer
    - Full-screen mode
    - Mouse/touch navigation
  - **Church Gallery**:
    - Photo grid from `church_images` table
    - Lightbox image viewer
    - Swipe/click navigation
  
- **Social Integration**:
  - Facebook page feed (if `facebook_url` is set)
  - Livestream embed (YouTube/Facebook iframe)
  
- **Action Buttons**:
  - "Book Appointment" → Navigate to booking page
  - "Edit Church" → Edit mode (admin only)
  - "Delete Church" → With confirmation (super admin only)

**Data Sources**:
- `churches` table → Church details
- `mass_schedules` table → Mass timings
- `church_images` table → Gallery photos
- Supabase Storage → 360° panorama images

---

#### AddChurchPage (`/churches/add`)
**File**: `src/pages/churches/AddChurchPage.tsx`

**Purpose**: Form to create a new church entry

**Features**:
- Multi-step form with validation
- Church information fields:
  - Name, description
  - Address (street, city, province, postal code)
  - Contact (phone, email, website)
  - Location (latitude, longitude)
  - Operating hours
  - QR codes for donations (GCash, Maya)
  - 360° panorama image upload
  - Livestream URL
- Image upload with compression
- Form validation with error messages
- Preview before submission

**Access Control**: Super Admin & Church Admin only

---

#### EditChurchPage (`/churches/:id/edit`)
**File**: `src/pages/churches/EditChurchPage.tsx`

**Purpose**: Edit existing church information

**Features**:
- Pre-populated form with current church data
- Same fields as AddChurchPage
- Image replacement functionality
- Save/Cancel actions
- Validation before update

**Access Control**: 
- Super Admin → Can edit any church
- Church Admin → Can only edit their assigned church

---

### 📅 Appointment Pages

#### AppointmentsPage (`/appointments`)
**File**: `src/pages/appointments/AppointmentsPage.tsx`

**Purpose**: Manage all sacrament appointment requests

**Features**:
- **Appointment Listing**:
  - Table view of all appointments
  - Columns: User name, Church, Service type, Date/Time, Status
  - Status badges with color coding
  
- **Status Management**:
  - Approve appointment → Change status to "approved"
  - Reject appointment → Change status to "rejected"
  - Reschedule → Change to "rescheduled"
  - Mark as completed
  - Cancel appointment
  
- **Filtering**:
  - Filter by status (pending, approved, rejected, etc.)
  - Filter by church (for church admins)
  - Filter by date range
  
- **Document Viewing**:
  - View uploaded requirement documents
  - Modal-based document viewer
  - Download documents
  
- **Notifications**:
  - Auto-notify users when status changes
  - Uses `notifyUserOfStatusChange()` function

**Role-Based Access**:
- Super Admin → See all appointments
- Church Admin → See only their church's appointments
- Regular User → See only their own appointments

**Data Sources**:
- `appointments` table → Appointment data
- `profiles` table → User info (via JOIN)
- `churches` table → Church info (via JOIN)
- `appointment_documents` table → Uploaded files

---

#### BookAppointmentPage (`/churches/:id/book`)
**File**: `src/pages/appointments/BookAppointmentPage.tsx`

**Purpose**: Book a new sacrament appointment at a specific church

**Features**:
- **Appointment Form**:
  - Select service type (baptism, wedding, funeral, confirmation, etc.)
  - Choose date and time
  - Add appointment notes/details
  
- **AI Scheduler Integration** (Planned):
  - Checks priest availability
  - Checks for scheduling conflicts
  - Suggests alternative time slots
  - Validates church operating hours
  
- **Document Upload**:
  - Dynamic requirement list based on service type
  - Fetches requirements from `sacrament_requirements` table
  - Multi-file upload component
  - File type validation
  - Required vs optional document indicators
  
- **Validation**:
  - Ensures all required documents are uploaded
  - Validates date/time selection
  - Checks form completeness
  
- **Submission**:
  - Creates appointment in database
  - Uploads documents to Supabase Storage
  - Links documents to appointment via `appointment_documents` table
  - Sends notification to church admins

**User Flow**:
1. Select church (or come from church detail page)
2. Choose sacrament type
3. Pick date and time
4. Upload required documents
5. Review booking details
6. Submit appointment request
7. Confirmation screen

---

### 👤 User Management Pages

#### UsersPage (`/users`)
**File**: `src/pages/admin/UsersPage.tsx`

**Purpose**: Admin interface for managing user accounts and roles

**Features**:
- **User Listing Table**:
  - Display all registered users
  - Columns: Full Name, Email, Role, Church Assignment, Join Date
  - Avatar/profile picture display
  
- **Search & Filter**:
  - Search by name or email
  - Filter by role (user, admin, super_admin, church_admin, volunteer)
  - Filter by church assignment
  
- **Role Management**:
  - Edit user role via modal dialog
  - Available roles:
    - `user` - Regular parishioner
    - `admin` - Parish administrator
    - `super_admin` - System administrator
    - `church_admin` - Church-specific admin
    - `volunteer` - Limited admin access
  
- **User Details**:
  - View full profile
  - Contact information
  - Appointment history
  - Date joined
  
- **Role Badge Styling**:
  - Color-coded badges for each role
  - Visual distinction between user types

**Access Control**: Super Admin & Admin only

**Data Source**: 
- `profiles` table → User data via `directFetchProfiles()` function

---

### 💰 Donation Pages

#### DonationsPage (`/donations`)
**File**: `src/pages/donations/DonationsPage.tsx`

**Purpose**: Manage and verify cashless donations

**Current Status**: UI scaffold created, full implementation pending

**Planned Features**:
- **Donation Verification System**:
  - View pending donation proofs
  - Display uploaded payment screenshots
  - Reference number verification
  - Approve/Reject donations
  
- **Tabs**:
  - Pending (awaiting verification)
  - Verified (approved donations)
  - All donations
  
- **Search & Filter**:
  - Search by donor name
  - Search by reference number
  - Filter by church
  - Filter by date range
  
- **Donation Details**:
  - Amount
  - Payment method (GCash/Maya)
  - Proof image
  - Timestamp
  - Donor information

**Data Schema** (from database):
- `donations` table with fields:
  - user_id, church_id, amount
  - payment_method, reference_number
  - proof_url (screenshot)
  - status (pending, verified, rejected)
  - created_at

**Access Control**: Church Admin & Super Admin only

---

### 📢 Announcement Pages

#### AnnouncementsPage (`/announcements`)
**File**: `src/pages/announcements/AnnouncementsPage.tsx`

**Purpose**: Create and manage parish announcements

**Current Status**: UI scaffold created, full implementation pending

**Planned Features**:
- **Announcement Management**:
  - Create new announcements
  - Edit existing announcements
  - Delete announcements
  - Publish/unpublish toggle
  
- **Announcement Form**:
  - Title and content editor
  - Image upload
  - Target church selection
  - Priority level
  - Expiration date
  
- **Display**:
  - List view of all announcements
  - Search functionality
  - Filter by church
  - Filter by status (active/expired)

**Data Schema** (from database):
- `announcements` table with fields:
  - title, content, image_url
  - church_id, priority
  - start_date, end_date
  - is_active

**Access Control**: Church Admin, Volunteer, & Super Admin

---

### 👤 Profile Pages

#### ProfilePage (`/profile`)
**File**: `src/pages/ProfilePage.tsx`

**Purpose**: User profile management and settings

**Features**:
- **Profile Information Display**:
  - Full name
  - Email address
  - Phone number
  - User role badge
  - Join date
  - Assigned church (for admins)
  
- **Avatar Management**:
  - Upload profile picture
  - Image cropping/resizing
  - Uses `AvatarUpload` component
  - Stores in Supabase Storage `avatars` bucket
  
- **Edit Profile**:
  - Edit mode toggle
  - Editable fields:
    - Full name
    - Phone number
    - Email (read-only, shows current)
  - Save/Cancel actions
  - Real-time validation
  
- **Account Information**:
  - Display account creation date
  - Show last login time
  - Current role assignment

**Technical Details**:
- Uses `getCurrentProfile()` to fetch data from `profiles` table
- Updates via Supabase `.update()` method
- Optimistic UI updates
- Date formatting using `date-fns`

---

## Component Architecture

### 🎨 UI Components (`components/ui/`)

Built using **Shadcn/UI** (Radix UI primitives):

| Component | Purpose |
|-----------|---------|
| `button.tsx` | Button with variants (primary, outline, ghost, destructive) |
| `input.tsx` | Text input field with validation states |
| `card.tsx` | Card container with header/content/footer |
| `label.tsx` | Form label component |
| `slot.tsx` | Polymorphic slot component |

### 📦 Feature Components

#### Authentication Components (`components/auth/`)
- **AuthLayout**: Wrapper layout for login/register pages
- **AuthTabs**: Tab navigation between login and register

#### Dashboard Components (`components/dashboard/`)
- **DailyVerse**: Bible verse widget for user dashboard

#### Church Components (`components/churches/`)
- **EditScheduleModal**: Modal for editing mass schedules
- **ImageLightbox**: Full-screen image viewer for gallery

#### Document Components (`components/documents/`)
- **DocumentUploader**: File upload with drag-and-drop
  - Supports multiple file types
  - Shows upload progress
  - File preview
  - Validation
- **DocumentViewerModal**: View uploaded documents in modal

#### Profile Components (`components/profile/`)
- **AvatarUpload**: Profile picture upload with preview

#### Social Components (`components/social/`)
- **FacebookFeed**: Embeds church Facebook page feed

#### Layout Components (`components/layout/`)
- **DashboardLayout**: Main layout with sidebar navigation
  - Responsive sidebar
  - Top navigation bar
  - User menu dropdown
  - Breadcrumb navigation
  - Role-based menu items

#### Admin Components (`components/admin/`)
- **EditRoleModal**: Modal for changing user roles

---

## Database Schema

### 📊 Core Tables

#### `profiles`
**Purpose**: User accounts (extends Supabase Auth users)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (references auth.users) |
| `email` | TEXT | User email |
| `full_name` | TEXT | User's full name |
| `phone` | TEXT | Contact number |
| `role` | ENUM | User role (user, admin, super_admin, church_admin, volunteer) |
| `church_id` | UUID | Assigned church (for admins) |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` | TIMESTAMP | Account creation date |
| `updated_at` | TIMESTAMP | Last profile update |

---

#### `churches`
**Purpose**: Parish/church information

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Church name |
| `description` | TEXT | Church description |
| `address` | TEXT | Street address |
| `city` | TEXT | City |
| `province` | TEXT | Province/state |
| `postal_code` | TEXT | Postal code |
| `latitude` | DECIMAL | GPS latitude |
| `longitude` | DECIMAL | GPS longitude |
| `phone` | TEXT | Contact phone |
| `email` | TEXT | Contact email |
| `website` | TEXT | Church website |
| `operating_hours` | JSONB | Opening hours JSON |
| `panorama_url` | TEXT | 360° image URL |
| `livestream_url` | TEXT | Live stream link |
| `facebook_url` | TEXT | Facebook page URL |
| `gcash_qr_url` | TEXT | GCash donation QR code |
| `maya_qr_url` | TEXT | Maya donation QR code |
| `created_at` | TIMESTAMP | Record creation date |
| `updated_at` | TIMESTAMP | Last update |

---

#### `appointments`
**Purpose**: Sacrament booking requests

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User who booked (FK → profiles) |
| `church_id` | UUID | Church (FK → churches) |
| `priest_id` | UUID | Assigned priest (FK → profiles) |
| `service_type` | ENUM | baptism, wedding, funeral, confirmation, etc. |
| `requested_date` | TIMESTAMP | Preferred date/time |
| `end_time` | TIMESTAMP | Appointment end time |
| `status` | ENUM | pending, approved, rejected, rescheduled, completed, cancelled |
| `notes` | TEXT | Additional notes |
| `created_at` | TIMESTAMP | Booking creation date |
| `updated_at` | TIMESTAMP | Last status update |

---

#### `mass_schedules`
**Purpose**: Weekly mass schedule per church

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `church_id` | UUID | Church (FK → churches) |
| `day_of_week` | TEXT | Monday, Tuesday, etc. |
| `time` | TIME | Mass time (24-hour format) |
| `mass_type` | TEXT | Regular, Holy Day, Special |
| `language` | TEXT | Tagalog, English, Latin |

---

#### `sacrament_requirements`
**Purpose**: Required documents per service type

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `service_type` | ENUM | Sacrament type |
| `requirement_name` | TEXT | Document name |
| `description` | TEXT | Requirement details |
| `is_required` | BOOLEAN | Mandatory or optional |
| `allowed_file_types` | TEXT[] | Accepted file types |
| `display_order` | INTEGER | UI display order |

---

#### `appointment_documents`
**Purpose**: User-uploaded requirement documents

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `appointment_id` | UUID | Appointment (FK → appointments) |
| `requirement_id` | UUID | Requirement (FK → sacrament_requirements) |
| `file_url` | TEXT | Supabase Storage URL |
| `file_name` | TEXT | Original filename |
| `file_type` | TEXT | MIME type |
| `uploaded_at` | TIMESTAMP | Upload timestamp |

---

#### `donations`
**Purpose**: Cashless donation records

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Donor (FK → profiles) |
| `church_id` | UUID | Church (FK → churches) |
| `amount` | DECIMAL | Donation amount |
| `payment_method` | TEXT | GCash, Maya |
| `reference_number` | TEXT | Transaction reference |
| `proof_url` | TEXT | Payment screenshot URL |
| `status` | ENUM | pending, verified, rejected |
| `verified_by` | UUID | Admin who verified (FK → profiles) |
| `created_at` | TIMESTAMP | Submission date |
| `verified_at` | TIMESTAMP | Verification date |

---

#### `announcements`
**Purpose**: Parish news and updates

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `church_id` | UUID | Church (FK → churches) |
| `title` | TEXT | Announcement title |
| `content` | TEXT | Announcement body |
| `image_url` | TEXT | Featured image |
| `priority` | INTEGER | Display priority |
| `start_date` | TIMESTAMP | Publish date |
| `end_date` | TIMESTAMP | Expiration date |
| `is_active` | BOOLEAN | Published status |
| `created_by` | UUID | Author (FK → profiles) |
| `created_at` | TIMESTAMP | Creation date |

---

#### `church_images`
**Purpose**: Church photo gallery

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `church_id` | UUID | Church (FK → churches) |
| `image_url` | TEXT | Image URL in storage |
| `caption` | TEXT | Image description |
| `display_order` | INTEGER | Gallery order |
| `uploaded_at` | TIMESTAMP | Upload date |

---

#### `notifications`
**Purpose**: User notification system

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Recipient (FK → profiles) |
| `title` | TEXT | Notification title |
| `message` | TEXT | Notification body |
| `type` | TEXT | appointment, announcement, donation |
| `is_read` | BOOLEAN | Read status |
| `created_at` | TIMESTAMP | Notification time |

---

### 🗄️ Storage Buckets

| Bucket Name | Access | Purpose |
|-------------|--------|---------|
| `avatars` | Public | User profile pictures |
| `panoramas` | Public | 360° church images |
| `donation-qr` | Public | Church QR code images (GCash/Maya) |
| `donation-proofs` | Private | User payment screenshots |
| `announcements` | Public | Announcement images |
| `documents` | Private | Appointment requirement uploads |
| `church-images` | Public | Church gallery photos |

---

## Feature Flags & Configuration

### Feature Flag System (`config/featureFlags.ts`)

Controls which features are visible in the application.

#### Environment Variable
```bash
VITE_DEMO_MODE=true  # Hide incomplete features for client demos
```

#### Available Flags

| Feature | Enabled | Description |
|---------|---------|-------------|
| `churches` | ✅ Always | Church directory and management |
| `appointments` | ✅ Always | Sacrament booking system |
| `donations` | ⚠️ Demo Mode OFF | Cashless donation verification |
| `announcements` | ⚠️ Demo Mode OFF | Parish announcements |
| `admin` | ⚠️ Demo Mode OFF | User management |
| `calendar` | ⚠️ Demo Mode OFF | Calendar view for appointments |

#### Dashboard Configuration

```typescript
dashboardConfig = {
  useMockData: isDemoMode,       // Use mock data in demo mode
  showQuickActions: !isDemoMode, // Hide quick actions in demo
  mockData: {
    totalUsers: 150,
    totalChurches: 12,
    pendingRequests: 8,
    upcomingAppointments: 24,
  }
}
```

---

## Authentication & Authorization

### Authentication Flow

#### Sign Up
1. User submits registration form → `RegisterPage`
2. `supabase.auth.signUp()` creates user in `auth.users`
3. Database trigger auto-creates row in `profiles` table
4. Default role set to `user`
5. User auto-logged in and redirected to dashboard

#### Sign In
1. User submits email/password → `LoginPage`
2. `supabase.auth.signInWithPassword()` authenticates
3. Session token stored in localStorage
4. AuthContext loads user profile from `profiles` table
5. Redirect to `/dashboard` based on role

#### Session Management
- Handled by `AuthContext` (`contexts/AuthContext.tsx`)
- Persists across page reloads via Supabase session
- Auto-refresh token handling
- Logout clears session and redirects to login

---

### Role-Based Access Control (RBAC)

#### User Roles

| Role | Access Level | Capabilities |
|------|--------------|-------------|
| **user** | Regular User | View churches, book appointments, donate, view announcements |
| **volunteer** | Limited Admin | Manage announcements, help with livestream setup |
| **church_admin** | Church Admin | Manage specific church (schedules, donations, appointments for their church) |
| **admin** | Parish Admin | Manage their assigned church, approve appointments, verify donations |
| **super_admin** | System Admin | Full access: create churches, manage all users, global stats, all data |

#### Permission Checks

**In App.tsx routing**:
```typescript
// Only allow users with valid roles
if (!profile || !['user', 'admin', 'super_admin', 'church_admin', 'volunteer']
    .includes(profile.role)) {
  return <AccessDenied />;
}
```

**In individual pages**:
```typescript
// Example from ChurchesPage
const canManage = (churchId: string) => {
  if (profile?.role === 'super_admin') return true;
  if (profile?.role === 'church_admin' && profile?.church_id === churchId) return true;
  return false;
};
```

---

### Row Level Security (RLS)

Database policies enforce role-based access at the database level:

- **Super Admin**: Can read/write all tables
- **Church Admin**: Can only modify data for their `church_id`
- **Regular Users**: Can only read public data and modify their own records
- **Public**: Some tables (like `churches`) are readable by all

Migration files: `supabase/migrations/004_enable_rls_all_tables.sql`

---

## Key Features

### 🤖 AI Scheduler (Deterministic Logic)

**Purpose**: Intelligent appointment scheduling based on availability

**Implementation Status**: Core logic defined, full integration pending

**Logic Flow**:
1. User selects Date/Time + Service Type + Church
2. System validates:
   - ✅ Church is open (check `churches.operating_hours`)
   - ✅ Priest is available (check `priest_availability`)
   - ✅ No scheduling conflicts (check `appointments` table)
   - ✅ Service duration fits (check `service_durations`)
3. If validation fails → Find and suggest next available slot
4. Return suggestion to user in modal

**Edge Function**: `supabase/functions/check-availability/`

**SQL Query Example**:
```sql
-- Check for appointment conflicts
SELECT * FROM appointments 
WHERE church_id = :church_id 
  AND status NOT IN ('cancelled', 'rejected')
  AND requested_date < :end_time 
  AND end_time > :requested_date;
```

---

### 🎥 360° Virtual Tour

**Implementation**:
- **Web**: `react-photo-sphere-viewer` component
- **Mobile**: WebView with Pannellum viewer

**Storage**: 
- Supabase Storage bucket: `panoramas/`
- Max file size: 10MB
- Format: Equirectangular JPG

**Features**:
- Full 360° pan and tilt
- Touch/mouse controls
- Auto-rotation option
- Full-screen mode

---

### 💸 Cashless Donations

**User Flow**:
1. User views church's QR code (GCash/Maya) in app
2. User saves QR image → Opens payment app → Makes payment
3. User takes screenshot of payment confirmation
4. Returns to app → Uploads screenshot + enters reference number
5. Submission creates record in `donations` table with status "pending"
6. Admin reviews in `DonationsPage` → Verifies payment
7. Admin approves/rejects → Status updated → User notified

**Technical Details**:
- QR codes stored in `donation-qr` bucket (public)
- Payment proofs stored in `donation-proofs` bucket (private)
- Manual verification process (no payment gateway integration)

---

### 📺 Livestreaming

**Implementation**: Embed external streams (no custom streaming server)

**Process**:
1. Admin pastes YouTube/Facebook Live URL in church settings
2. URL stored in `churches.livestream_url`
3. App embeds video using iframe/WebView
4. Users watch live stream in app

**Supported Platforms**:
- YouTube Live
- Facebook Live
- Vimeo Live

---

### 📱 Notification System

**Features**:
- In-app notifications
- Push notifications (planned)
- Real-time updates via Supabase Realtime

**Notification Types**:
- Appointment status changes
- New announcements
- Donation verification
- Admin alerts

**Implementation**:
- Database table: `notifications`
- Edge Function: `send-notification` (planned)
- Client: `lib/supabase/notifications.ts`

---

## Development Guidelines

### Code Standards

1. **TypeScript Only** - No `.js` files
2. **Supabase First** - Always check database schema before coding
3. **No Custom Auth** - Use Supabase Auth exclusively
4. **Tailwind CSS Only** - No custom CSS files
5. **Lucide Icons** - Use `lucide-react` package
6. **Error Handling** - Always handle loading/error states
7. **Type Safety** - Define TypeScript interfaces before implementing

### Environment Variables

```bash
# .env file
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=true  # Toggle demo mode
```

### Build Commands

```bash
# Development
npm run dev        # Start Vite dev server

# Production
npm run build      # TypeScript compile + Vite build
npm run preview    # Preview production build

# Linting
npm run lint       # Run ESLint
```

---

## Future Roadmap

### Phase 1 - Foundation ✅ (Complete)
- ✅ Monorepo structure
- ✅ Supabase configuration
- ✅ Database migrations
- ✅ Authentication context
- ✅ Shared TypeScript types

### Phase 2 - Web Dashboard ✅ (Complete)
- ✅ Auth pages (Login/Register)
- ✅ Dashboard layout with role-based access
- ✅ Church CRUD operations
- ✅ Mass schedule management
- ✅ User profile management
- ✅ Document upload system

### Phase 3 - Appointments ✅ (Complete)
- ✅ Appointment booking page
- ✅ Requirements system
- ✅ Document upload for requirements
- ✅ Appointment management dashboard
- ✅ Status update workflow

### Phase 4 - Advanced Features 🚧 (In Progress)
- ⚠️ AI scheduler Edge Function
- ⚠️ Donation verification system
- ⚠️ Announcements CRUD
- ⚠️ Push notifications
- ⚠️ Calendar view integration

### Phase 5 - Mobile App 📱 (Planned)
- React Native + Expo setup
- User-facing mobile interface
- Church browsing & search
- Mobile appointment booking
- Mobile donations
- Push notifications

### Phase 6 - Polish & Deployment 🚀 (Planned)
- Performance optimization
- Comprehensive testing
- User acceptance testing
- Production deployment
- Documentation completion

---

## Support & Maintenance

### Tech Stack Updates
- **Regular Updates**: Dependencies updated quarterly
- **Security Patches**: Applied immediately
- **Breaking Changes**: Documented in migration guides

### Database Migrations
- Location: `supabase/migrations/`
- Naming: `XXX_descriptive_name.sql`
- All migrations tracked and version controlled

### Monitoring
- **Supabase Dashboard**: Real-time database metrics
- **Vercel Analytics**: Web app performance (if deployed to Vercel)
- **Error Logging**: Console logs + future Sentry integration

---

## Conclusion

SACRALINK is a comprehensive church management system built with modern web technologies. The application leverages React, TypeScript, Tailwind CSS, and Supabase to deliver a fast, scalable, and maintainable solution for digitizing parish operations.

**Key Strengths**:
- ✅ Type-safe TypeScript throughout
- ✅ Modern, accessible UI with Tailwind CSS + Shadcn
- ✅ Scalable PostgreSQL database via Supabase
- ✅ Real-time features via Supabase Realtime
- ✅ Role-based access control
- ✅ Responsive design for all devices
- ✅ Extensible architecture with feature flags

This documentation will be updated as new features are implemented and the system evolves.

---

**Last Updated**: February 7, 2026  
**Maintained By**: Development Team  
**Project Version**: 1.0.0
