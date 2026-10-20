import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Wrench, CheckCircle, Megaphone } from 'lucide-react';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import { featureFlags } from '../../config/featureFlags';
import AnnouncementDetailModal from './AnnouncementDetailModal';
import type { SystemAnnouncement, SystemAnnouncementType } from '../../lib/supabase/announcements';

export interface SystemAnnouncementsBannerProps {
    /** 'circular' renders a compact strip with Read/Dismiss actions (priest dashboard) */
    variant?: 'default' | 'circular';
}

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
export default function SystemAnnouncementsBanner({ variant = 'default' }: SystemAnnouncementsBannerProps) {
    const { announcements, loading } = useSystemAnnouncements();
    const [openAnnouncement, setOpenAnnouncement] = useState<SystemAnnouncement | null>(null);
    const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('dismissedSystemAnnouncements');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

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

    if (variant === 'circular') {
        return (
            <div className="space-y-3">
                {visibleAnnouncements.map((announcement) => (
                    <div
                        key={announcement.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 rounded-2xl border border-blue-200 bg-blue-50/70 animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Megaphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary truncate">
                                    {announcement.title}
                                </p>
                                <p className="text-sm text-secondary-700 line-clamp-2">
                                    {announcement.content}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                            <button
                                type="button"
                                onClick={() => setOpenAnnouncement(announcement)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                            >
                                Read circular
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDismiss(announcement.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary-500 hover:text-foreground hover:bg-white/70 transition-colors cursor-pointer"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                ))}

                {openAnnouncement && (
                    <AnnouncementDetailModal
                        announcement={openAnnouncement}
                        type="system"
                        onClose={() => setOpenAnnouncement(null)}
                    />
                )}
            </div>
        );
    }

    // Type configurations
    const typeConfig: Record<SystemAnnouncementType, {
        icon: typeof AlertCircle;
        bgClass: string;
        iconClass: string;
        textClass: string;
        titleClass: string;
    }> = {
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
                const normalizedType = (announcement.type as SystemAnnouncementType) || 'info';
                const config = typeConfig[normalizedType] || typeConfig.info;
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
