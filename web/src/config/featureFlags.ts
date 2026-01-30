/**
 * Feature Flags Configuration
 * 
 * Controls which features are visible in the application.
 * Set VITE_DEMO_MODE=true in .env to hide incomplete features for client demos.
 */

// Check if demo mode is enabled via environment variable
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

interface FeatureFlag {
    enabled: boolean;
    label: string;
    description: string;
}

interface FeatureFlags {
    churches: FeatureFlag;
    appointments: FeatureFlag;
    donations: FeatureFlag;
    announcements: FeatureFlag;
    admin: FeatureFlag;
    calendar: FeatureFlag;
}

export const featureFlags: FeatureFlags = {
    // Churches feature (Phase 3 - completed)
    churches: {
        enabled: !isDemoMode, // Always enabled (can be toggled)
        label: 'Churches',
        description: 'Church directory and management',
    },

    // Appointments feature (Phase 4 - completed)
    appointments: {
        enabled: !isDemoMode, // Always enabled (can be toggled)
        label: 'Appointments',
        description: 'Sacrament booking and management',
    },

    // Donations feature (Phase 5 - not started)
    donations: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Donations',
        description: 'Cashless donation verification system',
    },

    // Announcements feature (Phase 6 - not started)
    announcements: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Announcements',
        description: 'Parish announcements management',
    },

    // Admin/Users management
    admin: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'User Management',
        description: 'Admin user management',
    },

    // Calendar view (Phase 4.8 bonus - incomplete)
    calendar: {
        enabled: !isDemoMode, // Hidden in demo mode
        label: 'Calendar View',
        description: 'Visual calendar for appointments',
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
    showQuickActions: false,   // true = show buttons, false = hide entire section

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
