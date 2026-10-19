import { Pin, Edit, Trash2, Building2, Megaphone, Clock } from 'lucide-react';
import type {
    ChurchAnnouncement,
    SystemAnnouncement,
    UnifiedAnnouncement,
    SystemAnnouncementType,
} from '../../lib/supabase/announcements';

interface AnnouncementCardProps {
    announcement: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement;
    type?: 'church' | 'system' | 'all';
    onEdit?: () => void;
    onDelete?: () => void;
    onView?: () => void;
    showActions?: boolean;
}

/**
 * AnnouncementCard - Modern divided horizontal row announcement display
 */
export default function AnnouncementCard({
    announcement,
    type = 'all',
    onEdit,
    onDelete,
    onView,
    showActions = false
}: AnnouncementCardProps) {
    const isChurchAnnouncement =
        'kind' in announcement
            ? announcement.kind === 'church'
            : 'church_id' in announcement && Boolean((announcement as ChurchAnnouncement).church_id)
                ? true
                : type === 'church';

    const churchAnn = announcement as ChurchAnnouncement;
    const systemAnn = announcement as SystemAnnouncement;

    // Format date e.g. "May 16, 2026"
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Type badge colors for system announcements
    const getTypeBadge = () => {
        if (isChurchAnnouncement || !systemAnn.type) return null;

        const badges: Record<SystemAnnouncementType | string, { icon: string; class: string }> = {
            info: { icon: '📘', class: 'bg-blue-100 text-blue-800' },
            warning: { icon: '⚠️', class: 'bg-yellow-100 text-yellow-800' },
            maintenance: { icon: '🔧', class: 'bg-orange-100 text-orange-800' },
            success: { icon: '✅', class: 'bg-green-100 text-green-800' },
        };

        const badge = badges[systemAnn.type] || { icon: '📢', class: 'bg-secondary-100 text-secondary-800' };

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badge.class}`}>
                <span>{badge.icon}</span>
                <span>{systemAnn.type.charAt(0).toUpperCase() + systemAnn.type.slice(1)}</span>
            </span>
        );
    };

    const category = (isChurchAnnouncement && churchAnn.category) ? churchAnn.category : 'general';

    return (
        <div className="py-4.5 sm:py-5 flex items-start justify-between gap-4 group hover:bg-secondary-50/40 transition-colors px-2 sm:px-3 rounded-2xl">
            {/* Left: Soft rounded icon badge */}
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
                <Megaphone className="w-5 h-5 text-primary" />
            </div>

            {/* Middle: Content */}
            <div className="flex-1 min-w-0 pr-2">
                {/* Badge row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Pinned pill */}
                    {isChurchAnnouncement && Boolean(churchAnn.is_pinned) && (
                        <span className="bg-amber-100/80 text-amber-900 border border-amber-200/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Pin className="w-3 h-3 text-amber-800" />
                            <span>Pinned</span>
                        </span>
                    )}

                    {/* Category badge */}
                    {isChurchAnnouncement && (
                        <span className="bg-secondary-100 text-secondary-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">
                            {category.replace('_', ' ')}
                        </span>
                    )}

                    {/* System announcement type badge */}
                    {!isChurchAnnouncement && getTypeBadge()}

                    {/* Date */}
                    <span className="text-xs text-secondary-500 font-normal">
                        Posted {formatDate(announcement.created_at || new Date().toISOString())}
                    </span>

                    {/* Church name for church announcements in aggregate view */}
                    {isChurchAnnouncement && churchAnn.church?.name && type !== 'church' && (
                        <span className="inline-flex items-center gap-1 text-xs text-secondary-600 font-medium">
                            <Building2 className="w-3 h-3 text-primary" />
                            {churchAnn.church.name}
                        </span>
                    )}
                </div>

                {/* Announcement Title */}
                <h3
                    onClick={onView}
                    className={`font-bold text-base text-foreground mt-1.5 ${onView ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                >
                    {announcement.title}
                </h3>

                {/* Content preview */}
                <p
                    onClick={onView}
                    className={`text-xs sm:text-sm text-secondary-600 leading-relaxed mt-1 line-clamp-2 ${onView ? 'cursor-pointer' : ''}`}
                >
                    {announcement.content}
                </p>

                {/* Read full announcement button */}
                {onView && (
                    <button
                        type="button"
                        onClick={onView}
                        className="mt-2 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                        Read full announcement &rarr;
                    </button>
                )}

                {/* Scheduled notice */}
                {isChurchAnnouncement && churchAnn.scheduled_at && new Date(churchAnn.scheduled_at) > new Date() && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            Scheduled: {new Date(churchAnn.scheduled_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                )}

                {/* Expiration notice for system announcements */}
                {!isChurchAnnouncement && systemAnn.expires_at && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs text-secondary-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires: {new Date(systemAnn.expires_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            {showActions && (onEdit || onDelete) && (
                <div className="flex items-center gap-2 shrink-0 self-start mt-0.5">
                    {onEdit && (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-2 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-secondary-600 hover:text-primary shadow-2xs transition-colors cursor-pointer"
                            title="Edit announcement"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-2 rounded-xl border border-border/80 bg-white hover:bg-red-50 text-secondary-600 hover:text-destructive shadow-2xs transition-colors cursor-pointer"
                            title="Delete announcement"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
