import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, ArrowRight, Calendar, Pin, Clock, ChevronRight, Users } from 'lucide-react';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import AnnouncementDetailModal from '../announcements/AnnouncementDetailModal';
import type { AnnouncementCategory, ChurchAnnouncement } from '../../lib/supabase/announcements';

interface ChurchAnnouncementsWidgetProps {
    churchId: string | null;
    churchName?: string;
    /** 'list' renders compact bulletin rows (priest dashboard) */
    variant?: 'default' | 'list';
}

const LIST_CATEGORY_CHIPS: Partial<Record<AnnouncementCategory, { label: string; className: string }>> = {
    mass_schedule: { label: 'Liturgical', className: 'bg-blue-50 text-primary border-blue-200' },
    event: { label: 'Community', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    reminder: { label: 'Reminder', className: 'bg-secondary-50 text-secondary-700 border-secondary-200' },
    emergency: { label: 'Urgent', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * ChurchAnnouncementsWidget - Display church announcements on dashboard
 *
 * Designed to conform to the SacraLink Design System:
 * - Rounded-2xl container with clean border, neutral background, and subtle shadow
 * - Faith Blue & Sacred Gold accents
 * - Responsive typography and accessible light mode aesthetics
 * - Inline detail modal with full announcement inspection
 */
export default function ChurchAnnouncementsWidget({ churchId, churchName, variant = 'default' }: ChurchAnnouncementsWidgetProps) {
    const navigate = useNavigate();
    const { announcements, loading } = useChurchAnnouncements(churchId || undefined);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<ChurchAnnouncement | null>(null);

    // Format relative time in a human-friendly manner
    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Don't render full list if no church selected
    if (!churchId) {
        return (
            <div className="rounded-2xl border border-border bg-white shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center shrink-0">
                        <Megaphone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-base">Parish Bulletin</h3>
                        <p className="text-xs text-muted">No parish assigned</p>
                    </div>
                </div>
                <div className="text-center py-8 rounded-xl border border-dashed border-border bg-secondary-50/40 p-6 space-y-2 text-muted">
                    <Megaphone className="w-10 h-10 mx-auto opacity-40 text-secondary-400" />
                    <p className="text-xs">Select or assign a church to view its parish announcements and bulletins.</p>
                </div>
            </div>
        );
    }

    // Loading skeleton
    if (loading) {
        return (
            <div className="rounded-2xl border border-border bg-white shadow-xs p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center shrink-0">
                        <Megaphone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-secondary-100 rounded w-36 animate-pulse" />
                        <div className="h-3 bg-secondary-100 rounded w-24 animate-pulse" />
                    </div>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl border border-border/70 bg-secondary-50/50 space-y-2 animate-pulse">
                            <div className="h-4 bg-secondary-200/60 rounded w-3/4" />
                            <div className="h-3 bg-secondary-200/50 rounded w-full" />
                            <div className="h-3 bg-secondary-200/40 rounded w-1/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Latest 3 announcements
    const latestAnnouncements = announcements.slice(0, 3);
    const displayChurchName = churchName || announcements[0]?.church?.name || 'Parish Community';

    if (variant === 'list') {
        return (
            <>
                <div className="rounded-2xl border border-border bg-white shadow-xs flex flex-col">
                    <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-2 border-b border-border/70">
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-base">Parish bulletin</h3>
                            <p className="text-xs text-muted truncate" title={displayChurchName}>
                                {displayChurchName}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${churchId}`)}
                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-700 transition-colors shrink-0 cursor-pointer"
                        >
                            View all
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {latestAnnouncements.length === 0 ? (
                        <div className="m-5 text-center rounded-xl border border-dashed border-border bg-secondary-50/40 p-6 space-y-2 text-muted">
                            <Calendar className="w-8 h-8 mx-auto opacity-40 text-secondary-400" />
                            <p className="text-xs">Bulletins published by the parish office will appear here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/70">
                            {latestAnnouncements.map((announcement) => {
                                const chip = LIST_CATEGORY_CHIPS[announcement.category];
                                const postedAt = announcement.scheduled_at || announcement.created_at;
                                return (
                                    <button
                                        key={announcement.id}
                                        type="button"
                                        onClick={() => setSelectedAnnouncement(announcement)}
                                        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-secondary-50/70 transition-colors group cursor-pointer"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                                            <Megaphone className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            {(announcement.is_pinned || chip) && (
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {announcement.is_pinned && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                            Pinned
                                                        </span>
                                                    )}
                                                    {chip && (
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${chip.className}`}>
                                                            {chip.label}
                                                        </span>
                                                    )}
                                                    {announcement.target_audience === 'parishioners' && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                            <Users className="w-2.5 h-2.5" />
                                                            <span>Parishioners</span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                                {announcement.title}
                                            </h4>
                                            <p className="text-xs text-muted line-clamp-1">
                                                {postedAt && `${new Date(postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · `}
                                                {announcement.content}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-secondary-400 shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-auto px-5 py-3.5 border-t border-border/70 flex justify-end">
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${churchId}`)}
                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary-700 transition-colors cursor-pointer"
                        >
                            Open full bulletin
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {selectedAnnouncement && (
                    <AnnouncementDetailModal
                        announcement={selectedAnnouncement}
                        type="church"
                        onClose={() => setSelectedAnnouncement(null)}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="rounded-2xl border border-border bg-white shadow-xs p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center shrink-0">
                            <Megaphone className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-base truncate">
                                Parish Bulletin
                            </h3>
                            <p className="text-xs text-muted truncate max-w-[200px] sm:max-w-xs" title={displayChurchName}>
                                {displayChurchName}
                            </p>
                        </div>
                    </div>

                    {latestAnnouncements.length > 0 && (
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${churchId}`)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-700 transition-colors shrink-0 cursor-pointer"
                        >
                            <span>View all</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Announcements List */}
                {latestAnnouncements.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-border bg-secondary-50/40 p-6 space-y-2 text-muted">
                        <Calendar className="w-10 h-10 mx-auto opacity-40 text-secondary-400" />
                        <h4 className="font-semibold text-xs text-foreground">No announcements from this church yet</h4>
                        <p className="text-[11px] text-muted max-w-xs mx-auto">
                            Bulletins and notices published by parish administration will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {latestAnnouncements.map((announcement) => {
                            const isPinned = Boolean(announcement.is_pinned);

                            return (
                                <button
                                    key={announcement.id}
                                    type="button"
                                    onClick={() => setSelectedAnnouncement(announcement)}
                                    className={`w-full p-4 rounded-xl border text-left transition-all group cursor-pointer space-y-2 ${
                                        isPinned
                                            ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50/70 hover:border-amber-300'
                                            : 'border-border bg-white hover:bg-secondary-50/80 hover:border-blue-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {isPinned && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                                    <Pin className="w-2.5 h-2.5 text-amber-700 fill-amber-700" />
                                                    Pinned
                                                </span>
                                            )}
                                            {announcement.category && announcement.category !== 'general' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-secondary-100 text-secondary-800 capitalize">
                                                    {announcement.category.replace('_', ' ')}
                                                </span>
                                            )}
                                            {announcement.target_audience === 'parishioners' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                                    <Users className="w-2.5 h-2.5" />
                                                    <span>Parishioners</span>
                                                </span>
                                            )}
                                        </div>

                                        <span className="text-[11px] text-muted shrink-0 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-secondary-400" />
                                            {formatRelativeTime(announcement.created_at || new Date().toISOString())}
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                            {announcement.title}
                                        </h4>
                                        <p className="text-xs text-muted line-clamp-2 leading-relaxed mt-1">
                                            {announcement.content}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] font-semibold text-primary">
                                        <span>Read details</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Announcement Detail Modal */}
            {selectedAnnouncement && (
                <AnnouncementDetailModal
                    announcement={selectedAnnouncement}
                    type="church"
                    onClose={() => setSelectedAnnouncement(null)}
                />
            )}
        </>
    );
}
