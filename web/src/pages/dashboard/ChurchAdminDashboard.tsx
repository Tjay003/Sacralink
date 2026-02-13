import { AlertCircle } from 'lucide-react';
import { SystemAnnouncementsBanner } from '../../components/announcements';
import ChurchHeader from '../../components/dashboard/ChurchHeader';
import ChurchStatsCards from '../../components/dashboard/ChurchStatsCards';
import ChurchAnnouncementsManagement from '../../components/dashboard/ChurchAnnouncementsManagement';
import RecentAppointmentsWidget from '../../components/dashboard/RecentAppointmentsWidget';
import DailyVerse from '../../components/dashboard/DailyVerse';
import { isFeatureEnabled } from '../../config/featureFlags';

interface ChurchAdminDashboardProps {
    churchId: string | null;
}

/**
 * ChurchAdminDashboard - Dashboard for church administrators
 * 
 * Features:
 * - Auto-locked to assigned church
 * - Church-specific statistics
 * - Announcement management
 * - Recent appointments
 * - Quick actions
 */
export default function ChurchAdminDashboard({ churchId }: ChurchAdminDashboardProps) {
    // Error state if no church assigned
    if (!churchId) {
        return (
            <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
                    <h3 className="text-lg font-semibold text-red-900 mb-2">No Church Assigned</h3>
                    <p className="text-sm text-red-700">
                        You are not currently assigned to a church. Please contact an administrator to be assigned to a parish.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* System Announcements Banner */}
            <SystemAnnouncementsBanner />

            {/* Church Header */}
            <ChurchHeader churchId={churchId} />

            {/* Stats Cards */}
            <ChurchStatsCards churchId={churchId} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Announcements Management */}
                    <ChurchAnnouncementsManagement churchId={churchId} />

                    {/* Recent Appointments */}
                    {isFeatureEnabled('churchRecentAppointments') && (
                        <RecentAppointmentsWidget churchId={churchId} limit={5} />
                    )}
                </div>

                {/* Right Column (1/3 width) */}
                <div className="space-y-6">
                    {/* Daily Verse */}
                    <DailyVerse />

                    {/* Quick Actions */}
                    {isFeatureEnabled('churchQuickLinks') && (
                        <div className="bg-card border rounded-lg p-6">
                            <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
                            <div className="space-y-2">
                                <a
                                    href={`/churches/${churchId}`}
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    📍 My Church Details
                                </a>
                                <a
                                    href="/appointments"
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    📅 All Appointments
                                </a>
                                <a
                                    href="/donations"
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    💝 Donations
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
