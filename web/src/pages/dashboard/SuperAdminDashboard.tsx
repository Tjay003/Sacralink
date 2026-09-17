import { useState } from 'react';
import { SystemAnnouncementsBanner } from '../../components/announcements';
import ChurchSelectorDropdown from '../../components/dashboard/ChurchSelectorDropdown';
import DioceseStatsCards from '../../components/dashboard/DioceseStatsCards';
import SystemAnnouncementsManagement from '../../components/dashboard/SystemAnnouncementsManagement';
import ChurchAdminDashboard from './ChurchAdminDashboard';
import DailyVerse from '../../components/dashboard/DailyVerse';
import { useAuth } from '../../contexts/AuthContext';
import { isFeatureEnabled } from '../../config/featureFlags';

/**
 * SuperAdminDashboard - Dashboard for super administrators
 * 
 * Features:
 * - Diocese-wide view (All Churches)
 * - Individual church dashboard view
 * - System announcements management
 * - Church performance comparison
 */
export default function SuperAdminDashboard() {
    const { profile } = useAuth();
    const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);

    // If specific church selected, show church admin dashboard
    if (selectedChurchId) {
        return (
            <div className="space-y-6">
                {/* Back to Diocese View */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedChurchId(null)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        ← Back to Diocese View
                    </button>
                </div>

                {/* Church Admin Dashboard */}
                <ChurchAdminDashboard churchId={selectedChurchId} />
            </div>
        );
    }

    // Diocese-wide view
    return (
        <div className="space-y-6">
            {/* System Announcements Banner */}
            {isFeatureEnabled('systemAnnouncements') && <SystemAnnouncementsBanner />}

            {/* Header with Church Selector */}
            <div className="rounded-lg shadow-sm p-6 bg-gradient-to-r from-blue-600 to-blue-400 text-white border-none">
                <h1 className="text-2xl font-bold mb-2">
                    Welcome Back, {profile?.full_name?.split(' ')[0] || 'Admin'}!
                </h1>
                <p className="text-white/90 opacity-90 mb-4">
                    Diocese Dashboard - Manage all churches and system-wide settings
                </p>

                {/* Church Selector */}
                {isFeatureEnabled('churchSelector') && (
                    <ChurchSelectorDropdown
                        selectedChurchId={selectedChurchId}
                        onChurchSelect={setSelectedChurchId}
                    />
                )}
            </div>

            {/* Diocese-Wide Stats */}
            <DioceseStatsCards selectedChurchId={selectedChurchId} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* System Announcements Management */}
                    {isFeatureEnabled('systemAnnouncements') && <SystemAnnouncementsManagement />}
                </div>

                {/* Right Column (1/3 width) */}
                <div className="space-y-6">
                    {/* Daily Verse */}
                    {isFeatureEnabled('dailyVerse') && <DailyVerse />}
                </div>
            </div>
        </div>
    );
}
