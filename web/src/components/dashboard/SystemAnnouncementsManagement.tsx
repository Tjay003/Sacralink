import { Link } from 'react-router-dom';
import {
    Wrench,
    Info,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
} from 'lucide-react';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import type { SystemAnnouncement } from '../../lib/supabase/announcements';

/**
 * SystemAnnouncementsManagement - Modern widget for displaying system announcements on dashboard
 *
 * Features:
 * - Live banners overview with distinct icons per severity type
 * - Quick navigation to full system announcements manager
 * - Shows latest 5 announcements with expiry/creation details
 */
export default function SystemAnnouncementsManagement() {
    const { announcements, loading } = useSystemAnnouncements({ includeInactive: true });

    // Latest 5 announcements
    const latestAnnouncements = announcements.slice(0, 5);

    const formatAnnouncementDate = (announcement: SystemAnnouncement) => {
        if (announcement.expires_at) {
            const date = new Date(announcement.expires_at);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            const formattedTime = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
            return `Expires ${formattedDate}, ${formattedTime}`;
        }

        if (announcement.created_at) {
            const date = new Date(announcement.created_at);
            return `Created ${date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })}`;
        }

        return 'Active banner';
    };

    const getAnnouncementIcon = (type: string | null | undefined) => {
        const normalized = type?.toLowerCase() || 'info';
        switch (normalized) {
            case 'maintenance':
                return (
                    <div className="w-10 h-10 rounded-2xl bg-secondary-100 flex items-center justify-center text-secondary-700 flex-shrink-0">
                        <Wrench className="w-5 h-5" />
                    </div>
                );
            case 'warning':
                return (
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                );
            case 'urgent':
            case 'emergency':
                return (
                    <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-700 flex-shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                );
            case 'success':
                return (
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                );
            case 'info':
            case 'general':
            default:
                return (
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-primary flex-shrink-0">
                        <Info className="w-5 h-5" />
                    </div>
                );
        }
    };

    const getTypeBadgeClass = (type: string | null | undefined) => {
        const normalized = type?.toLowerCase() || 'info';
        switch (normalized) {
            case 'maintenance':
                return 'bg-secondary-100 text-secondary-700';
            case 'warning':
                return 'bg-amber-100 text-amber-800';
            case 'urgent':
            case 'emergency':
                return 'bg-red-100 text-red-800';
            case 'success':
                return 'bg-emerald-100 text-emerald-800';
            case 'info':
            case 'general':
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <>
            <div className="bg-white border border-border/80 rounded-2xl p-6 shadow-xs relative h-full flex flex-col justify-between">
                <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4">
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">System announcements</h3>
                            <p className="text-xs sm:text-sm text-secondary-500 font-normal">Live banners for every user</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Link
                                to="/admin/system-announcements"
                                className="text-sm font-semibold text-primary hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
                            >
                                Manage <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Announcements List */}
                    <div className="flex-1 flex flex-col">
                        {loading ? (
                            <div className="divide-y divide-border/60">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex items-center gap-3.5 animate-pulse">
                                        <div className="w-10 h-10 rounded-2xl bg-secondary-100 flex-shrink-0" />
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="h-4 bg-secondary-200/60 rounded w-2/5" />
                                            <div className="h-3 bg-secondary-100 rounded w-1/4" />
                                        </div>
                                        <div className="w-16 h-6 bg-secondary-100 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : latestAnnouncements.length === 0 ? (
                            <div className="text-center py-8 text-secondary-500 my-auto">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-secondary-100 flex items-center justify-center text-secondary-400">
                                    <Info className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-semibold text-foreground">No system announcements yet</p>
                                <p className="text-xs text-secondary-500 mt-1">Click &quot;Manage&quot; to create one</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {latestAnnouncements.map((announcement) => (
                                    <div
                                        key={announcement.id}
                                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            {getAnnouncementIcon(announcement.type)}
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-foreground text-sm tracking-tight line-clamp-1">
                                                    {announcement.title}
                                                </h4>
                                                <p className="text-xs text-secondary-500 mt-0.5">
                                                    {formatAnnouncementDate(announcement)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`font-medium text-xs px-2.5 py-1 rounded-full capitalize ${getTypeBadgeClass(announcement.type)}`}>
                                                {announcement.type || 'info'}
                                            </span>
                                            {!announcement.is_active && (
                                                <span className="bg-secondary-100 text-secondary-500 font-medium text-xs px-2.5 py-1 rounded-full">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* View All Footer */}
                {latestAnnouncements.length > 0 && announcements.length > 5 && (
                    <div className="mt-4 pt-3 border-t border-border/60 text-center">
                        <Link
                            to="/admin/system-announcements"
                            className="text-xs font-medium text-secondary-500 hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                            Showing 5 of {announcements.length} announcements &bull; View all
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}
