import { Pin, Edit, Trash2, Building2, Calendar } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';

interface AnnouncementCardProps {
    announcement: ChurchAnnouncement | SystemAnnouncement;
    type: 'church' | 'system';
    onEdit?: () => void;
    onDelete?: () => void;
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
        if (type !== 'system') return null;

        const badges = {
            info: { icon: '📘', class: 'bg-blue-100 text-blue-800' },
            warning: { icon: '⚠️', class: 'bg-yellow-100 text-yellow-800' },
            maintenance: { icon: '🔧', class: 'bg-orange-100 text-orange-800' },
            success: { icon: '✅', class: 'bg-green-100 text-green-800' },
        };

        const badge = badges[systemAnn.type];
        return (
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.class}`}>
                {badge.icon} {systemAnn.type.charAt(0).toUpperCase() + systemAnn.type.slice(1)}
            </span>
        );
    };

    return (
        <div className={`card p-4 ${isChurchAnnouncement ? 'border-l-4 border-primary' : 'border-l-4 border-blue-500'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
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
                            Posted {formatDate(announcement.created_at)}
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

            {/* Content */}
            <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
            </div>

            {/* Expiration notice for system announcements */}
            {type === 'system' && systemAnn.expires_at && (
                <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted">
                        Expires: {new Date(systemAnn.expires_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
            )}
        </div>
    );
}
