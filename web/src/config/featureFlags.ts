/**
 * Feature Flags Configuration
 * 
 * Controls which features are visible in the application.
 * Set VITE_DEMO_MODE=true in .env to hide incomplete features for client demos.
 */

// Check if demo mode is enabled via environment variable
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// Export isDemoMode so components can check it directly
export { isDemoMode };


interface FeatureFlag {
    enabled: boolean;
    label: string;
    description: string;
}

interface FeatureFlags {
    // === SUPER ADMIN FEATURES ===
    systemAnnouncements: FeatureFlag;
    churchSelector: FeatureFlag;
    admin: FeatureFlag;

    // === CHURCH ADMIN FEATURES ===
    churchAnnouncements: FeatureFlag;
    churchQuickLinks: FeatureFlag;
    churchRecentAppointments: FeatureFlag;

    // === SHARED FEATURES (All Roles) ===
    churches: FeatureFlag;
    appointments: FeatureFlag;
    donations: FeatureFlag;
    calendar: FeatureFlag;

    // === USER FEATURES ===
    dailyVerse: FeatureFlag;
    quickLinks: FeatureFlag; // Regular user quick links
    userChurchSelector: FeatureFlag;
    userUpcomingAppointments: FeatureFlag;
}

export const featureFlags: FeatureFlags = {
    // ========================================
    // SUPER ADMIN FEATURES
    // ========================================

    // System Announcements (Phase 3.5 - completed)
    systemAnnouncements: {
        enabled: true, // Always visible, buttons disabled in demo mode
        label: 'System Announcements',
        description: 'App-wide announcements management and banner',
    },

    // Church Selector (Super Admin Dashboard)
    churchSelector: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Church Selector',
        description: 'Dropdown to select and manage different churches',
    },

    // Admin/Users management
    admin: {
        enabled: true, // Always enabled
        label: 'User Management',
        description: 'Admin user management',
    },

    // ========================================
    // CHURCH ADMIN FEATURES
    // ========================================

    // Church Announcements (Church Admin Dashboard)
    churchAnnouncements: {
        enabled: true, // Always visible, buttons disabled in demo mode
        label: 'Church Announcements',
        description: 'Manage parish-specific announcements',
    },

    // Church Quick Links (Church Admin Dashboard)
    churchQuickLinks: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Church Quick Links',
        description: 'Quick action links for church admin',
    },

    // Church Recent Appointments (Church Admin Dashboard)
    churchRecentAppointments: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Recent Appointments',
        description: 'Recent appointment bookings for the church',
    },

    // ========================================
    // SHARED FEATURES (All Roles)
    // ========================================

    // Churches feature (Phase 3 - completed)
    churches: {
        enabled: !isDemoMode,
        label: 'Churches',
        description: 'Church directory and management',
    },

    // Appointments feature (Phase 4 - completed)
    appointments: {
        enabled: !isDemoMode,
        label: 'Appointments',
        description: 'Sacrament booking and management',
    },

    // Donations feature (Phase 5 - not started)
    donations: {
        enabled: !isDemoMode,
        label: 'Donations',
        description: 'Cashless donation verification system',
    },

    // Calendar view (Phase 4.8 bonus - incomplete)
    calendar: {
        enabled: !isDemoMode,
        label: 'Calendar View',
        description: 'Visual calendar for appointments',
    },

    // ========================================
    // USER FEATURES
    // ========================================

    // Daily Bible Verse
    dailyVerse: {
        enabled: true,
        label: 'Daily Verse',
        description: 'Daily Bible verse widget on dashboard',
    },

    // Quick Links (Regular User Dashboard)
    quickLinks: {
        enabled: !isDemoMode,
        label: 'Quick Links',
        description: 'Quick action links on user dashboard',
    },

    // Church Selector (User Dashboard)
    userChurchSelector: {
        enabled: true, // Always visible, but disabled in demo mode
        label: 'Church Selector',
        description: 'Dropdown to select church for viewing announcements',
    },

    // Upcoming Appointments (User Dashboard)
    userUpcomingAppointments: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Upcoming Appointments',
        description: 'List of user\'s upcoming appointments',
    },
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
    return featureFlags[feature].enabled;
};

// Dashboard Configuration - Controls mock data and UI elements
export const dashboardConfig = {
    // Toggle between real database data and mock data for demos
    useMockData: isDemoMode,  // true = use mock data, false = fetch real data from Supabase

    // Show/hide quick actions section on dashboard
    showQuickActions: !isDemoMode,   // true when demo mode OFF, false when demo mode ON

    // Mock data values (only used when useMockData = true)
    // Customize these values for your demo presentations
    mockData: {
        totalUsers: 150,
        totalChurches: 12,
        pendingRequests: 8,
        upcomingAppointments: 24,
    },
};

// Log current mode for debugging
if (isDemoMode) {
    console.log('🎭 Demo Mode: ON - Incomplete features hidden');
} else {
    console.log('🔧 Dev Mode: ON - All features visible');
}
