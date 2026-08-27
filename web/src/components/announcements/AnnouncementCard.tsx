import { Pin, Edit, Trash2, Building2, Calendar, Megaphone, Church, CalendarDays, AlertTriangle, Bell, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
    ChurchAnnouncement,
    SystemAnnouncement,
    UnifiedAnnouncement,
    AnnouncementCategory,
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
 * AnnouncementCard - Display a single announcement
 * 
 * Features:
 * - Different styling for church vs system announcements
 * - System announcements show type badge
 * - Church announcements show church name
 * - Edit/Delete actions (conditional)
 * - Pinned indicator for church announcements
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

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;

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

        const badge = badges[systemAnn.type] || { icon: '📢', class: 'bg-gray-100 text-gray-800' };

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.class}`}>
                {badge.icon} {systemAnn.type.charAt(0).toUpperCase() + systemAnn.type.slice(1)}
            </span>
        );
    };

    // Category badge for church announcements
    const CATEGORY_STYLES: Record<AnnouncementCategory | string, { icon: LucideIcon; class: string; border: string }> = {
        general:       { icon: Megaphone,     class: 'bg-gray-100 text-gray-700 border-gray-200',     border: 'border-gray-400' },
        mass_schedule: { icon: Church,        class: 'bg-blue-100 text-blue-700 border-blue-200',     border: 'border-blue-500' },
        event:         { icon: CalendarDays,  class: 'bg-purple-100 text-purple-700 border-purple-200', border: 'border-purple-500' },
        emergency:     { icon: AlertTriangle, class: 'bg-red-100 text-red-700 border-red-200',         border: 'border-red-500' },
        reminder:      { icon: Bell,          class: 'bg-amber-100 text-amber-700 border-amber-200',   border: 'border-amber-500' },
    };

    const category = (isChurchAnnouncement && churchAnn.category) ? churchAnn.category : 'general';
    const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
    const CatIcon = catStyle.icon;

    const getCategoryBadge = () => {
        if (!isChurchAnnouncement) return null;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${catStyle.class}`}>
                <CatIcon className="w-3 h-3" />
                {category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </span>
        );
    };

    return (
        <div className={`card p-4 border-l-4 transition-all duration-200 hover:shadow-md ${isChurchAnnouncement ? catStyle.border : 'border-blue-500'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Category badge (church only) */}
                        {isChurchAnnouncement && getCategoryBadge()}

                        {/* System announcement type badge */}
                        {!isChurchAnnouncement && getTypeBadge()}

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-foreground truncate">{announcement.title}</h3>

                        {/* Pinned indicator */}
                        {isChurchAnnouncement && Boolean(churchAnn.is_pinned) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                <Pin className="w-3 h-3" />
                                Pinned
                            </span>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-sm text-muted flex-wrap">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Posted {formatDate(announcement.created_at || new Date().toISOString())}
                        </span>

                        {/* Church name for church announcements */}
                        {isChurchAnnouncement && churchAnn.church?.name && (
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                                <Building2 className="w-3 h-3 text-primary" />
                                {churchAnn.church.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {showActions && (onEdit || onDelete) && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors text-muted hover:text-foreground"
                                title="Edit announcement"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500 hover:text-red-700"
                                title="Delete announcement"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content — truncated, full text via modal */}
            <div className="prose prose-sm max-w-none">
                <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3 text-sm leading-relaxed">{announcement.content}</p>
            </div>

            {/* Read more button */}
            {onView && (
                <button
                    onClick={onView}
                    className="mt-2 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                    Read full announcement →
                </button>
            )}

            {/* Scheduled notice */}
            {isChurchAnnouncement && churchAnn.scheduled_at && new Date(churchAnn.scheduled_at) > new Date() && (
                <div className="mt-3 pt-3 border-t border-border">
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
                <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires: {new Date(systemAnn.expires_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                </div>
            )}
        </div>
    );
}
