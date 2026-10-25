import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Megaphone, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { getParishApplications } from '../../lib/supabase/parishApplications';
import { getSystemAnnouncements } from '../../lib/supabase/announcements';

interface AttentionData {
    pendingApplicationsCount: number;
    applicationSampleNames: string[];
    activeAnnouncementsCount: number;
    latestAnnouncementTitle: string | null;
}

export default function NeedsYourAttentionWidget() {
    const navigate = useNavigate();
    const [data, setData] = useState<AttentionData>({
        pendingApplicationsCount: 0,
        applicationSampleNames: [],
        activeAnnouncementsCount: 0,
        latestAnnouncementTitle: null,
    });
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // Fetch pending parish applications
            const applicationsPromise = getParishApplications({
                status: 'pending',
                pageSize: 5,
            });

            // Fetch active system announcements
            const announcementsPromise = getSystemAnnouncements({
                limit: 3,
                includeInactive: false,
            });

            const [appsRes, annRes] = await Promise.all([
                applicationsPromise,
                announcementsPromise,
            ]);

            const appsCount = appsRes.count || (appsRes.data ? appsRes.data.length : 0);
            const sampleNames = (appsRes.data || [])
                .map((app) => app.parish_name)
                .filter(Boolean)
                .slice(0, 2);

            const activeAnnCount = annRes.count || (annRes.data ? annRes.data.length : 0);
            const latestAnnTitle = annRes.data && annRes.data.length > 0 ? annRes.data[0].title : null;

            setData({
                pendingApplicationsCount: appsCount,
                applicationSampleNames: sampleNames,
                activeAnnouncementsCount: activeAnnCount,
                latestAnnouncementTitle: latestAnnTitle,
            });
        } catch (error) {
            console.error('Error loading attention triage items:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalOpenCount =
        data.pendingApplicationsCount +
        data.activeAnnouncementsCount;

    return (
        <div className="bg-white border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between h-full">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-border/80 flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground tracking-tight">
                        Needs your attention
                    </h3>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-0.5">
                        Items waiting for your review
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-600 text-xs font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking...</span>
                    </div>
                ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                        {totalOpenCount} open
                    </span>
                )}
            </div>

            {/* List Content */}
            <div className="divide-y divide-border/70 flex-1">
                {/* Row 1: Parish Applications */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-secondary-50/50 transition-colors">
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-100/90 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                            <Shield className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                {data.pendingApplicationsCount > 0
                                    ? `${data.pendingApplicationsCount} church ${data.pendingApplicationsCount === 1 ? 'application needs' : 'applications need'} review`
                                    : 'Church applications up to date'}
                            </p>
                            <p className="text-[11px] sm:text-xs text-secondary-500 font-medium truncate mt-0.5">
                                {data.applicationSampleNames.length > 0
                                    ? `Awaiting decree verification for ${data.applicationSampleNames.join(', ')}`
                                    : 'New church setup & celebret credential reviews'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/applications')}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                    >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5 text-secondary-400" />
                    </button>
                </div>

                {/* Row 2: Active System Announcements */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-secondary-50/50 transition-colors">
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-secondary-100 text-secondary-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                            <Megaphone className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                {data.activeAnnouncementsCount > 0
                                    ? `${data.activeAnnouncementsCount} system ${data.activeAnnouncementsCount === 1 ? 'announcement' : 'announcements'} currently active`
                                    : 'No system announcement active'}
                            </p>
                            <p className="text-[11px] sm:text-xs text-secondary-500 font-medium truncate mt-0.5">
                                {data.latestAnnouncementTitle
                                    ? `Latest: "${data.latestAnnouncementTitle}"`
                                    : 'System-wide notices, advisories, and maintenance alerts'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/system-announcements')}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                    >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5 text-secondary-400" />
                    </button>
                </div>
            </div>

            {/* Footer Status */}
            <div className="px-5 py-3.5 bg-secondary-50/70 border-t border-border flex items-center justify-between text-xs text-secondary-600 font-medium">
                <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Privacy policy active (financial metrics excluded)
                </span>
                <button
                    type="button"
                    onClick={() => loadData()}
                    className="hover:text-primary transition-colors cursor-pointer text-[11px] font-semibold text-secondary-500"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}
