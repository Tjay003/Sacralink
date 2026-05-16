import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Megaphone, Church, CalendarDays, AlertTriangle, Bell, Pin, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';
import { notifyFollowersOfAnnouncement } from '../../lib/supabase/notifications';

interface AnnouncementFormProps {
    type: 'church' | 'system';
    churchId?: string; // Required for church announcements
    churchName?: string; // Used for follower notifications
    announcement?: ChurchAnnouncement | SystemAnnouncement; // For editing
    onSuccess: () => void;
    onCancel: () => void;
}

type AnnouncementCategory = 'general' | 'mass_schedule' | 'event' | 'emergency' | 'reminder';

const CATEGORIES: { value: AnnouncementCategory; label: string; icon: LucideIcon; color: string }[] = [
    { value: 'general',       label: 'General',       icon: Megaphone,     color: 'bg-gray-100 text-gray-700 border-gray-200' },
    { value: 'mass_schedule', label: 'Mass Schedule',  icon: Church,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'event',         label: 'Event',          icon: CalendarDays,  color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'emergency',     label: 'Emergency',      icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'reminder',      label: 'Reminder',       icon: Bell,          color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

/**
 * AnnouncementForm - Create/Edit form for announcements
 *
 * Features:
 * - Create or edit church/system announcements
 * - Validation
 * - Category tag selector for church announcements
 * - Optional scheduled publish date for church announcements
 * - Pin checkbox for church announcements
 * - Notifies church followers on new announcement
 * - Type selector and expiration date for system announcements
 */
export default function AnnouncementForm({
    type,
    churchId,
    churchName,
    announcement,
    onSuccess,
    onCancel,
}: AnnouncementFormProps) {
    const isEditing = !!announcement;
    const isChurchAnnouncement = type === 'church';

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        isPinned: false,
        category: 'general' as AnnouncementCategory,
        scheduledAt: '',
        announcementType: 'info' as 'info' | 'warning' | 'maintenance' | 'success',
        expiresAt: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill form when editing
    useEffect(() => {
        if (announcement) {
            const churchAnn = announcement as ChurchAnnouncement;
            const sysAnn = announcement as SystemAnnouncement;
            setFormData({
                title: announcement.title,
                content: announcement.content,
                isPinned: isChurchAnnouncement ? (churchAnn.is_pinned || false) : false,
                category: isChurchAnnouncement ? ((churchAnn as any).category || 'general') : 'general',
                scheduledAt: isChurchAnnouncement && (churchAnn as any).scheduled_at
                    ? new Date((churchAnn as any).scheduled_at).toISOString().slice(0, 16)
                    : '',
                announcementType: !isChurchAnnouncement ? ((sysAnn.type as any) || 'info') : 'info',
                expiresAt: !isChurchAnnouncement && sysAnn.expires_at
                    ? new Date(sysAnn.expires_at).toISOString().slice(0, 16)
                    : '',
            });
        }
    }, [announcement]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.title.trim()) { setError('Title is required'); return; }
        if (formData.title.length > 255) { setError('Title must be 255 characters or less'); return; }
        if (!formData.content.trim()) { setError('Content is required'); return; }
        if (isChurchAnnouncement && !churchId) { setError('Church ID is required'); return; }

        setLoading(true);

        try {
            if (isChurchAnnouncement) {
                const churchData: any = {
                    church_id: churchId!,
                    title: formData.title.trim(),
                    content: formData.content.trim(),
                    is_pinned: formData.isPinned,
                    category: formData.category,
                    scheduled_at: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
                };

                if (isEditing) {
                    const { error: updateError } = await supabase
                        .from('church_announcements')
                        .update(churchData)
                        .eq('id', announcement.id);
                    if (updateError) throw updateError;
                } else {
                    const { data: inserted, error: insertError } = await supabase
                        .from('church_announcements')
                        .insert([churchData])
                        .select('id')
                        .single();
                    if (insertError) throw insertError;

                    // Notify followers (fire-and-forget, non-blocking)
                    if (inserted?.id && churchId) {
                        notifyFollowersOfAnnouncement(
                            churchId,
                            churchName || 'Your followed church',
                            inserted.id,
                            formData.title.trim()
                        );
                    }
                }
            } else {
                const systemData = {
                    title: formData.title.trim(),
                    content: formData.content.trim(),
                    type: formData.announcementType,
                    expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
                    is_active: true,
                };

                if (isEditing) {
                    const { error: updateError } = await supabase
                        .from('system_announcements')
                        .update(systemData)
                        .eq('id', announcement.id);
                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('system_announcements')
                        .insert([systemData]);
                    if (insertError) throw insertError;
                }
            }

            onSuccess();
        } catch (err: any) {
            console.error('Error saving announcement:', err);
            setError(err.message || 'Failed to save announcement');
        } finally {
            setLoading(false);
        }
    };

    const selectedCategory = CATEGORIES.find(c => c.value === formData.category) || CATEGORIES[0];

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">
                        {isEditing ? 'Edit' : 'Create'} {isChurchAnnouncement ? 'Church' : 'System'} Announcement
                    </h2>
                    <button onClick={onCancel} className="p-2 hover:bg-secondary-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="input w-full"
                            placeholder="Announcement title"
                            maxLength={255}
                            required
                        />
                        <p className="text-xs text-muted mt-1">{formData.title.length}/255 characters</p>
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="input w-full"
                            placeholder="Announcement content..."
                            rows={5}
                            required
                        />
                    </div>

                    {/* Church-specific: Category */}
                    {isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Category</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, category: cat.value })}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                            formData.category === cat.value
                                                ? cat.color + ' ring-2 ring-offset-1 ring-current'
                                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                    >
                                        <cat.icon className="w-3.5 h-3.5 shrink-0" />
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Church-specific: Scheduled Publish */}
                    {isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Schedule Publish Date{' '}
                                <span className="text-xs font-normal text-muted">(Optional — leave blank to publish now)</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.scheduledAt}
                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                className="input w-full"
                                min={new Date().toISOString().slice(0, 16)}
                            />
                            {formData.scheduledAt && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> This announcement will only be visible to users after the scheduled time.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Church-specific: Pin checkbox */}
                    {isChurchAnnouncement && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <input
                                type="checkbox"
                                id="isPinned"
                                checked={formData.isPinned}
                                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <label htmlFor="isPinned" className="text-sm cursor-pointer select-none flex items-center gap-1.5">
                                <Pin className="w-3.5 h-3.5 text-primary" />
                                <span className="font-medium">Pin this announcement</span>
                                <span className="text-muted">(appears at the top)</span>
                            </label>
                        </div>
                    )}

                    {/* System-specific: Type selector */}
                    {!isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Announcement Type</label>
                            <select
                                value={formData.announcementType}
                                onChange={(e) => setFormData({ ...formData, announcementType: e.target.value as any })}
                                className="input w-full"
                            >
                                <option value="info">📘 Info - General information</option>
                                <option value="warning">⚠️ Warning - Important notice</option>
                                <option value="maintenance">🔧 Maintenance - System maintenance</option>
                                <option value="success">✅ Success - Good news</option>
                            </select>
                        </div>
                    )}

                    {/* System-specific: Expiration date */}
                    {!isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Expiration Date (Optional)</label>
                            <input
                                type="datetime-local"
                                value={formData.expiresAt}
                                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                className="input w-full"
                                min={new Date().toISOString().slice(0, 16)}
                            />
                            <p className="text-xs text-muted mt-1">Leave empty for permanent announcement</p>
                        </div>
                    )}

                    {/* Preview badge */}
                    {isChurchAnnouncement && (() => {
                        const SelIcon = selectedCategory.icon;
                        return (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Preview Badge</p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedCategory.color}`}>
                                    <SelIcon className="w-3.5 h-3.5" /> {selectedCategory.label}
                                </span>
                            </div>
                        );
                    })()}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'} Announcement
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
