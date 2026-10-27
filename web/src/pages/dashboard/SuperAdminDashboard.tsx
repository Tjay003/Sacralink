import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, X, ShieldCheck, Megaphone, Plus } from 'lucide-react';
import ChurchSelectorDropdown from '../../components/dashboard/ChurchSelectorDropdown';
import DioceseStatsCards from '../../components/dashboard/DioceseStatsCards';
import SystemAnnouncementsManagement from '../../components/dashboard/SystemAnnouncementsManagement';
import ChurchPerformanceGrid from '../../components/dashboard/ChurchPerformanceGrid';
import RecentActivityWidget from '../../components/dashboard/RecentActivityWidget';
import ChurchAdminDashboard from './ChurchAdminDashboard';
import NeedsYourAttentionWidget from '../../components/dashboard/NeedsYourAttentionWidget';
import { useAuth } from '../../contexts/AuthContext';
import { isFeatureEnabled } from '../../config/featureFlags';
import { getDailyReadings } from '../../lib/liturgy';

/**
 * SuperAdminDashboard - Dashboard for super administrators
 * 
 * Features:
 * - All-churches view (All Churches)
 * - Individual church dashboard view
 * - System announcements management
 * - Church performance comparison (Privacy-preserving: No donation amounts)
 * - Recent sacrament bookings across parishes
 * 
 * Security Blindspot Policy:
 * - Super Admins are strictly prohibited from viewing parish financial metrics,
 *   donation amounts, or transaction statistics. All donation reporting is private
 *   to local parish administration.
 */
export default function SuperAdminDashboard() {
    const { profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const churchParam = searchParams.get('church');
    const [selectedChurchId, setSelectedChurchId] = useState<string | null>(churchParam);

    // Sync state when URL search param changes
    useEffect(() => {
        setSelectedChurchId(churchParam);
    }, [churchParam]);

    const handleChurchSelect = (churchId: string | null) => {
        setSelectedChurchId(churchId);
        if (churchId) {
            setSearchParams({ church: churchId });
        } else {
            setSearchParams({});
        }
    };

    const [notice, setNotice] = useState<string | null>(
        (location.state as { notice?: string })?.notice || null
    );

    const currentHour = new Date().getHours();
    const isEvening = currentHour >= 18;
    const isAfternoon = currentHour >= 12 && currentHour < 18;
    const timeGreeting = isEvening ? 'Magandang gabi' : isAfternoon ? 'Magandang hapon' : 'Magandang araw';
    const timeOfDay = isEvening ? 'evening' : isAfternoon ? 'afternoon' : 'morning';
    const adminName = profile?.full_name?.split(' ')[0] || 'Admin';

    const todayReadings = getDailyReadings(new Date());
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const liturgicalBadge = `${dayOfWeek} · ${todayReadings.title.toUpperCase()}`;

    const noticeBanner = notice ? (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 shadow-sm" role="alert">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-amber-900">Access Restricted</h4>
                    <p className="text-xs sm:text-sm text-amber-800">{notice}</p>
                </div>
            </div>
            <button
                onClick={() => setNotice(null)}
                className="text-amber-700 hover:text-amber-900 p-1.5 hover:bg-amber-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Dismiss notice"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    ) : null;

    // If specific church selected, show church admin dashboard
    if (selectedChurchId) {
        return (
            <div className="space-y-6">
                {noticeBanner}
                {/* Back to All Churches */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => handleChurchSelect(null)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                        <span>← Back to All Churches</span>
                    </button>
                </div>

                {/* Church Admin Dashboard */}
                <ChurchAdminDashboard churchId={selectedChurchId} />
            </div>
        );
    }

    // All-churches view
    return (
        <div className="space-y-6">
            {noticeBanner}

            {/* Super Admin Welcome & Operations Card */}
            <div className="relative rounded-3xl bg-gradient-to-r from-blue-100/70 via-white/80 via-40% to-amber-100/80 border border-amber-200/60 shadow-sm p-6 sm:p-7 z-20">
                {/* Ambient Faith Blue and Sacred Gold glows (2x richness), clipped on their own layer so the church dropdown can open past the card */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                    <div className="absolute -top-14 -left-14 w-80 h-80 bg-blue-200/60 rounded-full blur-3xl" />
                    <div className="absolute -top-14 -right-14 w-96 h-96 bg-amber-200/70 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
                    {/* Left Column: Liturgical tag + Heading + Subtitle */}
                    <div className="space-y-1.5 sm:space-y-2">
                        {/* Liturgical Tag */}
                        <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50/90 border border-amber-200 px-3 py-1 rounded-full shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            <span className="text-amber-800">{liturgicalBadge}</span>
                        </div>

                        {/* Large Editorial Heading */}
                        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight">
                            {timeGreeting}, {adminName}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xs sm:text-sm text-secondary-600 font-medium">
                            Here is how San Jose del Monte is doing this {timeOfDay}.
                        </p>
                    </div>

                    {/* Right Column: Dropdown (Top) + Action Buttons (Bottom) - aligned to the left of its container */}
                    <div className="flex flex-col items-start gap-3 flex-shrink-0">
                        {isFeatureEnabled('churchSelector') && (
                            <div className="w-full sm:w-80 lg:w-[380px] xl:w-[420px] max-w-full relative z-30">
                                <ChurchSelectorDropdown
                                    selectedChurchId={selectedChurchId}
                                    onChurchSelect={handleChurchSelect}
                                    variant="light"
                                    allLabel="All parishes"
                                />
                            </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 relative z-10">
                            <button
                                onClick={() => navigate('/admin/applications')}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold bg-primary hover:bg-blue-700 text-white shadow-xs transition-colors"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Review applications</span>
                            </button>

                            {isFeatureEnabled('systemAnnouncements') && (
                                <button
                                    onClick={() => navigate('/admin/system-announcements')}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold bg-white hover:bg-secondary-50 text-secondary-800 border border-border shadow-xs transition-colors"
                                >
                                    <Megaphone className="w-4 h-4 text-secondary-600" />
                                    <span>New announcement</span>
                                </button>
                            )}

                            <button
                                onClick={() => navigate('/churches')}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold bg-white hover:bg-secondary-50 text-secondary-800 border border-border shadow-xs transition-colors"
                            >
                                <Plus className="w-4 h-4 text-secondary-600" />
                                <span>Add parish</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* All-Churches Stats (Includes Total Services Completed, strictly no Giving) */}
            <DioceseStatsCards selectedChurchId={selectedChurchId} />

            {/* Needs Your Attention Row */}
            <div>
                <NeedsYourAttentionWidget />
            </div>

            {/* Parish Performance Grid (Members & Active Events, strictly no Giving) */}
            <ChurchPerformanceGrid onSelectChurch={handleChurchSelect} />

            {/* Main Content Grid: Recent Activity & Announcements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Left Column (2/3 width) - Recent Activity Stream */}
                <div className="lg:col-span-2 h-full flex flex-col">
                    <RecentActivityWidget churchId={selectedChurchId} />
                </div>

                {/* Right Column (1/3 width) - System Announcements Management */}
                <div className="h-full flex flex-col">
                    {isFeatureEnabled('systemAnnouncements') && <SystemAnnouncementsManagement />}
                </div>
            </div>
        </div>
    );
}
