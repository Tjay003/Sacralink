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
    churchRecentAppointments: FeatureFlag;
    churchAiSync: FeatureFlag;

    // === SHARED FEATURES (All Roles) ===
    churches: FeatureFlag;
    appointments: FeatureFlag;
    messages: FeatureFlag;
    donations: FeatureFlag;
    calendar: FeatureFlag;

    // === USER FEATURES ===
    dailyVerse: FeatureFlag;
    userChurchSelector: FeatureFlag;
    userUpcomingAppointments: FeatureFlag;
    socialAuth: FeatureFlag;

    // === AI FEATURES ===
    parishionerChatbot: FeatureFlag;
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
        enabled: true, // Always visible
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

    // Church Recent Appointments (Church Admin Dashboard)
    churchRecentAppointments: {
        enabled: true, // Always enabled
        label: 'Recent Appointments',
        description: 'Recent appointment bookings for the church',
    },

    // AI Parish Assistant Sync (Church Admin Dashboard)
    churchAiSync: {
        enabled: true, // Always enabled
        label: 'AI Parish Assistant Sync',
        description: 'AI knowledge base sync widget on church admin dashboard',
    },

    // ========================================
    // SHARED FEATURES (All Roles)
    // ========================================

    // Churches feature (Phase 3 - completed)
    churches: {
        enabled: true, // Always visible
        label: 'Churches',
        description: 'Church directory and management',
    },

    // Appointments feature (Phase 4 - completed)
    appointments: {
        enabled: true,
        label: 'Appointments',
        description: 'Sacrament booking and management',
    },

    // Real-Time Messaging & Conferencing (Phase 6 - Ticket 05)
    messages: {
        enabled: true,
        label: 'Messages',
        description: 'Real-time messaging and embedded video conferencing',
    },

    // Donations feature (Phase 5 - completed)
    donations: {
        enabled: true, // Always visible - feature is complete
        label: 'Donations',
        description: 'Cashless donation verification system',
    },

    // Calendar view (Phase 4.8 bonus)
    calendar: {
        enabled: true, // Always enabled
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

    // Church Selector (User Dashboard)
    userChurchSelector: {
        enabled: true, // Always visible
        label: 'Church Selector',
        description: 'Dropdown to select church for viewing announcements',
    },

    // Upcoming Appointments (User Dashboard)
    userUpcomingAppointments: {
        enabled: true, // Always enabled
        label: 'Upcoming Appointments',
        description: 'List of user\'s upcoming appointments',
    },

    // Social Authentication (Login/Register)
    socialAuth: {
        enabled: true, // Always visible
        label: 'Social Authentication',
        description: 'Google login button',
    },

    // AI Parishioner Chatbot (Church Detail Page)
    parishionerChatbot: {
        enabled: true, // Always enabled
        label: 'AI Parishioner Assistant',
        description: 'AI chatbot on church pages that answers parishioner questions using church data',
    },
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
    return featureFlags[feature].enabled;
};

// Dashboard Configuration - Controls mock data and UI elements
export const dashboardConfig = {
    // Toggle between real database data and mock data for demos.
    // NOTE: Always uses real Supabase data so live churches, stats, and appointments appear.
    useMockData: false,  // Always real data

    // Mock data values (only used as fallback when useMockData = true)
    mockData: {
        totalUsers: 150,
        totalChurches: 12,
        pendingRequests: 8,
        upcomingAppointments: 24,
    },
};

// Log current mode for debugging
console.log('✨ All features enabled (Demo mode overrides inactive - full platform exposed)');
