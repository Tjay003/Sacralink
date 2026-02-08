import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';

interface AnnouncementFormProps {
    type: 'church' | 'system';
    churchId?: string; // Required for church announcements
    announcement?: ChurchAnnouncement | SystemAnnouncement; // For editing
    onSuccess: () => void;
    onCancel: () => void;
}

/**
 * AnnouncementForm - Create/Edit form for announcements
 * 
 * Features:
 * - Create or edit church/system announcements
 * - Validation
 * - Pin checkbox for church announcements
 * - Type selector and expiration date for system announcements
 */
export default function AnnouncementForm({
    type,
    churchId,
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
        announcementType: 'info' as 'info' | 'warning' | 'maintenance' | 'success',
        expiresAt: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill form when editing
    useEffect(() => {
        if (announcement) {
            setFormData({
                title: announcement.title,
                content: announcement.content,
                isPinned: isChurchAnnouncement ? (announcement as ChurchAnnouncement).is_pinned : false,
                announcementType: !isChurchAnnouncement ? (announcement as SystemAnnouncement).type : 'info',
                expiresAt: !isChurchAnnouncement && (announcement as SystemAnnouncement).expires_at
                    ? new Date((announcement as SystemAnnouncement).expires_at!).toISOString().slice(0, 16)
                    : '',
            });
        }
    }, [announcement]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.title.trim()) {
            setError('Title is required');
            return;
        }

        if (formData.title.length > 255) {
            setError('Title must be 255 characters or less');
            return;
        }

        if (!formData.content.trim()) {
            setError('Content is required');
            return;
        }

        if (isChurchAnnouncement && !churchId) {
            setError('Church ID is required for church announcements');
            return;
        }

        setLoading(true);

        try {
            if (isChurchAnnouncement) {
                // Church announcement
                const churchData = {
                    church_id: churchId!,
                    title: formData.title.trim(),
                    content: formData.content.trim(),
                    is_pinned: formData.isPinned,
                };

                if (isEditing) {
                    const { error: updateError } = await supabase
                        .from('church_announcements')
                        // @ts-expect-error - Supabase generated types don't match insert types
                        .update(churchData)
                        .eq('id', announcement.id);

                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('church_announcements')
                        // @ts-expect-error - Supabase generated types don't match insert types
                        .insert([churchData]);

                    if (insertError) throw insertError;
                }
            } else {
                // System announcement
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
                        // @ts-expect-error - Supabase generated types don't match insert types
                        .update(systemData)
                        .eq('id', announcement.id);

                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('system_announcements')
                        // @ts-expect-error - Supabase generated types don't match insert types
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">
                        {isEditing ? 'Edit' : 'Create'} {isChurchAnnouncement ? 'Church' : 'System'} Announcement
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-secondary-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Error Message */}
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
                        <p className="text-xs text-muted mt-1">
                            {formData.title.length}/255 characters
                        </p>
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
                            rows={6}
                            required
                        />
                    </div>

                    {/* Church-specific: Pin checkbox */}
                    {isChurchAnnouncement && (
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="isPinned"
                                checked={formData.isPinned}
                                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <label htmlFor="isPinned" className="ml-2 text-sm">
                                📌 Pin this announcement (appears at the top)
                            </label>
                        </div>
                    )}

                    {/* System-specific: Type selector */}
                    {!isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Announcement Type
                            </label>
                            <select
                                value={formData.announcementType}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    announcementType: e.target.value as any
                                })}
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
                            <label className="block text-sm font-medium mb-2">
                                Expiration Date (Optional)
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.expiresAt}
                                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                className="input w-full"
                                min={new Date().toISOString().slice(0, 16)}
                            />
                            <p className="text-xs text-muted mt-1">
                                Leave empty for permanent announcement
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-secondary flex-1"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
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
