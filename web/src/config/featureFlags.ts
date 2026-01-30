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
    donations: FeatureFlag;
    announcements: FeatureFlag;
    admin: FeatureFlag;
    calendar: FeatureFlag;
}

export const featureFlags: FeatureFlags = {
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

// Log current mode for debugging
if (isDemoMode) {
    console.log('🎭 Demo Mode: ON - Incomplete features hidden');
} else {
    console.log('🔧 Dev Mode: ON - All features visible');
}
