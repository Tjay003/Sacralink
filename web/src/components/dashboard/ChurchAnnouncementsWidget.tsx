import { useNavigate } from 'react-router-dom';
import { Megaphone, ArrowRight, Calendar } from 'lucide-react';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';

interface ChurchAnnouncementsWidgetProps {
    churchId: string | null;
    churchName?: string;
}

/**
 * ChurchAnnouncementsWidget - Display church announcements on dashboard
 * 
 * Features:
 * - Shows latest 3 announcements
 * - Compact preview cards
 * - Links to church detail page
 */
export default function ChurchAnnouncementsWidget({ churchId, churchName }: ChurchAnnouncementsWidgetProps) {
    const navigate = useNavigate();
    const { announcements, loading } = useChurchAnnouncements(churchId || '');

    // Don't render if no church selected
    if (!churchId) {
        return (
            <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Church Announcements</h3>
                        <p className="text-sm text-muted-foreground">Select a church to view announcements</p>
                    </div>
                </div>

                <div className="text-center py-8 text-muted-foreground">
                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Select a church above to see their latest announcements</p>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                        <div className="h-5 bg-muted rounded w-48 mb-2 animate-pulse" />
                        <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                    </div>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
                            <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-muted-foreground/20 rounded w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Latest 3 announcements
    const latestAnnouncements = announcements.slice(0, 3);

    // Format relative time
    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="bg-card border rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Church Announcements</h3>
                        <p className="text-sm text-muted-foreground">
                            {churchName || 'Latest updates'}
                        </p>
                    </div>
                </div>

                {latestAnnouncements.length > 0 && (
                    <button
                        onClick={() => navigate(`/churches/${churchId}`)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        View all
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Announcements List */}
            {latestAnnouncements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No announcements from this church yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {latestAnnouncements.map((announcement) => (
                        <button
                            key={announcement.id}
                            onClick={() => navigate(`/churches/${churchId}`)}
                            className="w-full p-4 bg-background border rounded-lg hover:bg-muted transition-colors text-left group"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground group-hover:text-blue-600 transition-colors mb-1 line-clamp-1">
                                        {announcement.title}
                                    </h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                        {announcement.content.substring(0, 100)}
                                        {announcement.content.length > 100 && '...'}
                                    </p>
                                    <span className="text-xs text-muted-foreground">
                                        {formatRelativeTime(announcement.created_at)}
                                    </span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
