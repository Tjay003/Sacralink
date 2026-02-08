import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Wrench, CheckCircle } from 'lucide-react';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import { featureFlags } from '../../config/featureFlags';

/**
 * SystemAnnouncementsBanner - Display active system announcements on dashboard
 * 
 * Features:
 * - Shows all active, non-expired system announcements
 * - Dismissible per announcement (remembered via localStorage)
 * - Type-specific styling and icons
 * - Auto-hides when all announcements dismissed
 * - Real-time updates via Supabase subscription
 */
export default function SystemAnnouncementsBanner() {
    const { announcements, loading } = useSystemAnnouncements();
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);

    // Load dismissed IDs from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('dismissedSystemAnnouncements');
        if (stored) {
            try {
                setDismissedIds(JSON.parse(stored));
            } catch {
                setDismissedIds([]);
            }
        }
    }, []);

    // Save to localStorage whenever dismissed IDs change
    useEffect(() => {
        localStorage.setItem('dismissedSystemAnnouncements', JSON.stringify(dismissedIds));
    }, [dismissedIds]);

    const handleDismiss = (announcementId: string) => {
        setDismissedIds(prev => [...prev, announcementId]);
    };

    // Filter out dismissed announcements
    const visibleAnnouncements = announcements.filter(
        announcement => !dismissedIds.includes(announcement.id)
    );

    // Don't render if feature is disabled
    if (!featureFlags.systemAnnouncements.enabled) {
        return null;
    }

    // Don't render anything if loading or no visible announcements
    if (loading || visibleAnnouncements.length === 0) {
        return null;
    }

    // Type configurations
    const typeConfig = {
        info: {
            icon: AlertCircle,
            bgClass: 'bg-blue-50 border-blue-200',
            iconClass: 'text-blue-600',
            textClass: 'text-blue-900',
            titleClass: 'text-blue-900',
        },
        warning: {
            icon: AlertTriangle,
            bgClass: 'bg-yellow-50 border-yellow-200',
            iconClass: 'text-yellow-600',
            textClass: 'text-yellow-900',
            titleClass: 'text-yellow-900',
        },
        maintenance: {
            icon: Wrench,
            bgClass: 'bg-orange-50 border-orange-200',
            iconClass: 'text-orange-600',
            textClass: 'text-orange-900',
            titleClass: 'text-orange-900',
        },
        success: {
            icon: CheckCircle,
            bgClass: 'bg-green-50 border-green-200',
            iconClass: 'text-green-600',
            textClass: 'text-green-900',
            titleClass: 'text-green-900',
        },
    };

    return (
        <div className="space-y-3 mb-6">
            {visibleAnnouncements.map((announcement) => {
                const config = typeConfig[announcement.type];
                const Icon = config.icon;

                return (
                    <div
                        key={announcement.id}
                        className={`relative flex items-start gap-3 p-4 rounded-lg border ${config.bgClass} animate-in fade-in slide-in-from-top-2 duration-300`}
                    >
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                            <Icon className={`w-5 h-5 ${config.iconClass}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold ${config.titleClass} mb-1`}>
                                {announcement.title}
                            </h4>
                            <p className={`text-sm ${config.textClass} whitespace-pre-wrap`}>
                                {announcement.content}
                            </p>
                            {announcement.expires_at && (
                                <p className={`text-xs ${config.textClass} opacity-75 mt-2`}>
                                    Expires: {new Date(announcement.expires_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            )}
                        </div>

                        {/* Dismiss Button */}
                        <button
                            onClick={() => handleDismiss(announcement.id)}
                            className="flex-shrink-0 p-1.5 hover:bg-black/5 rounded transition-colors"
                            title="Dismiss announcement"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
