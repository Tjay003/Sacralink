import { Pin, Edit, Trash2, Building2, Calendar, Megaphone, Church, CalendarDays, AlertTriangle, Bell, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';

interface AnnouncementCardProps {
    announcement: ChurchAnnouncement | SystemAnnouncement;
    type: 'church' | 'system';
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
    type,
    onEdit,
    onDelete,
    onView,
    showActions = false
}: AnnouncementCardProps) {
    const isChurchAnnouncement = type === 'church';
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
        if (type !== 'system' || !systemAnn.type) return null;

        const badges: Record<string, { icon: string; class: string }> = {
            info: { icon: '📘', class: 'bg-blue-100 text-blue-800' },
            warning: { icon: '⚠️', class: 'bg-yellow-100 text-yellow-800' },
            maintenance: { icon: '🔧', class: 'bg-orange-100 text-orange-800' },
            success: { icon: '✅', class: 'bg-green-100 text-green-800' },
        };

        const badge = badges[systemAnn.type];
        if (!badge) return null;

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.class}`}>
                {badge.icon} {systemAnn.type.charAt(0).toUpperCase() + systemAnn.type.slice(1)}
            </span>
        );
    };

    // Category badge for church announcements
    const CATEGORY_STYLES: Record<string, { icon: LucideIcon; class: string; border: string }> = {
        general:      { icon: Megaphone,     class: 'bg-gray-100 text-gray-700 border-gray-200',     border: 'border-gray-400' },
        mass_schedule:{ icon: Church,        class: 'bg-blue-100 text-blue-700 border-blue-200',     border: 'border-blue-500' },
        event:        { icon: CalendarDays,  class: 'bg-purple-100 text-purple-700 border-purple-200', border: 'border-purple-500' },
        emergency:    { icon: AlertTriangle, class: 'bg-red-100 text-red-700 border-red-200',         border: 'border-red-500' },
        reminder:     { icon: Bell,          class: 'bg-amber-100 text-amber-700 border-amber-200',   border: 'border-amber-500' },
    };

    const category = (churchAnn as any).category || 'general';
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
        <div className={`card p-4 border-l-4 ${isChurchAnnouncement ? catStyle.border : 'border-blue-500'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Category badge (church only) */}
                        {isChurchAnnouncement && getCategoryBadge()}

                        {/* Title */}
                        <h3 className="text-lg font-semibold">{announcement.title}</h3>

                        {/* Pinned indicator */}
                        {isChurchAnnouncement && churchAnn.is_pinned && (
                            <Pin className="w-4 h-4 text-primary" />
                        )}

                        {/* System announcement type badge */}
                        {type === 'system' && getTypeBadge()}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-sm text-muted">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Posted {formatDate(announcement.created_at || new Date().toISOString())}
                        </span>

                        {/* Church name for church announcements */}
                        {isChurchAnnouncement && (churchAnn as any).church && (
                            <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {(churchAnn as any).church.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {showActions && (onEdit || onDelete) && (
                    <div className="flex items-center gap-2">
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
                                title="Edit announcement"
                            >
                                <Edit className="w-4 h-4 text-muted" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete announcement"
                            >
                                <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content — truncated, full text via modal */}
            <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-wrap line-clamp-3">{announcement.content}</p>
            </div>

            {/* Read more button */}
            {onView && (
                <button
                    onClick={onView}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                    Read more →
                </button>
            )}

            {/* Scheduled notice */}
            {isChurchAnnouncement && (churchAnn as any).scheduled_at && new Date((churchAnn as any).scheduled_at) > new Date() && (
                <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Scheduled: {new Date((churchAnn as any).scheduled_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </p>
                </div>
            )}

            {/* Expiration notice for system announcements */}
            {type === 'system' && systemAnn.expires_at && (
                <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted">
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
