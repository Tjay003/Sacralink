import { createPortal } from 'react-dom';
import { X, Pin, Calendar, Building2, Clock, Megaphone, Church, CalendarDays, AlertTriangle, Bell } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';

interface AnnouncementDetailModalProps {
    announcement: ChurchAnnouncement | SystemAnnouncement;
    type: 'church' | 'system';
    onClose: () => void;
}

const CATEGORY_META: Record<string, { icon: LucideIcon; class: string; label: string }> = {
    general:       { icon: Megaphone,     class: 'bg-gray-100 text-gray-700 border-gray-200',     label: 'General' },
    mass_schedule: { icon: Church,        class: 'bg-blue-100 text-blue-700 border-blue-200',     label: 'Mass Schedule' },
    event:         { icon: CalendarDays,  class: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Event' },
    emergency:     { icon: AlertTriangle, class: 'bg-red-100 text-red-700 border-red-200',         label: 'Emergency' },
    reminder:      { icon: Bell,          class: 'bg-amber-100 text-amber-700 border-amber-200',   label: 'Reminder' },
};

const SYSTEM_TYPE_META: Record<string, { icon: string; class: string }> = {
    info:        { icon: '📘', class: 'bg-blue-100 text-blue-800' },
    warning:     { icon: '⚠️', class: 'bg-yellow-100 text-yellow-800' },
    maintenance: { icon: '🔧', class: 'bg-orange-100 text-orange-800' },
    success:     { icon: '✅', class: 'bg-green-100 text-green-800' },
};

export default function AnnouncementDetailModal({ announcement, type, onClose }: AnnouncementDetailModalProps) {
    const isChurch = type === 'church';
    const churchAnn = announcement as ChurchAnnouncement;
    const systemAnn = announcement as SystemAnnouncement;

    const category = (churchAnn as any).category || 'general';
    const catMeta = CATEGORY_META[category] || CATEGORY_META.general;
    const CatIcon = catMeta.icon;

    const formatDate = (ds: string) =>
        new Date(ds).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">

                {/* Colored header strip based on category */}
                <div className={`px-6 pt-5 pb-4 border-b border-border ${isChurch ? '' : 'bg-blue-50'}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {isChurch && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${catMeta.class}`}>
                                        <CatIcon className="w-3 h-3" />
                                        {catMeta.label}
                                    </span>
                                )}
                                {!isChurch && systemAnn.type && (() => {
                                    const sm = SYSTEM_TYPE_META[systemAnn.type];
                                    return sm ? (
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sm.class}`}>
                                            {sm.icon} {systemAnn.type.charAt(0).toUpperCase() + systemAnn.type.slice(1)}
                                        </span>
                                    ) : null;
                                })()}
                                {isChurch && churchAnn.is_pinned && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                        <Pin className="w-3 h-3" /> Pinned
                                    </span>
                                )}
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold leading-snug">{announcement.title}</h2>

                            {/* Meta */}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(announcement.created_at || new Date().toISOString())}
                                </span>
                                {isChurch && (churchAnn as any).church?.name && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" />
                                        {(churchAnn as any).church.name}
                                    </span>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 text-muted hover:text-foreground transition-colors shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed text-sm">
                        {announcement.content}
                    </p>

                    {/* Scheduled notice */}
                    {isChurch && (churchAnn as any).scheduled_at && new Date((churchAnn as any).scheduled_at) > new Date() && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-700">
                            <Clock className="w-4 h-4 shrink-0" />
                            Scheduled for: {new Date((churchAnn as any).scheduled_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                            })}
                        </div>
                    )}

                    {/* Expiry notice */}
                    {!isChurch && systemAnn.expires_at && (
                        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-muted">
                            Expires: {new Date(systemAnn.expires_at).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
