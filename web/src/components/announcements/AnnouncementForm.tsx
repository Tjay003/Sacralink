import { useState, useEffect } from 'react';
import { Megaphone, Church, CalendarDays, AlertTriangle, Bell, Pin, Clock, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    createChurchAnnouncement,
    updateChurchAnnouncement,
    createSystemAnnouncement,
    updateSystemAnnouncement,
    type AnnouncementCategory,
    type SystemAnnouncementType,
    type ChurchAnnouncement,
    type SystemAnnouncement,
    type UnifiedAnnouncement,
} from '../../lib/supabase/announcements';
import Modal from '../ui/Modal';

interface ChurchOption {
    id: string;
    name: string;
}

interface AnnouncementFormProps {
    type: 'church' | 'system';
    churchId?: string; // Required for church announcements if churches not provided
    churchName?: string; // Used for follower notifications
    churches?: ChurchOption[]; // Optional list of churches for selection
    announcement?: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement; // For editing
    onSuccess: () => void;
    onCancel: () => void;
}

const CATEGORIES: { value: AnnouncementCategory; label: string; icon: LucideIcon; color: string }[] = [
    { value: 'general',       label: 'General',       icon: Megaphone,     color: 'bg-gray-100 text-gray-700 border-gray-200' },
    { value: 'mass_schedule', label: 'Mass Schedule',  icon: Church,        color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'event',         label: 'Event',          icon: CalendarDays,  color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { value: 'emergency',     label: 'Emergency',      icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'reminder',      label: 'Reminder',       icon: Bell,          color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

const SYSTEM_TYPES: { value: SystemAnnouncementType; label: string; icon: string }[] = [
    { value: 'info',        label: 'Info',        icon: '📘' },
    { value: 'warning',     label: 'Warning',     icon: '⚠️' },
    { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
    { value: 'success',     label: 'Success',     icon: '✅' },
];

/**
 * AnnouncementForm - Create/Edit form for announcements
 */
export default function AnnouncementForm({
    type,
    churchId,
    churchName,
    churches = [],
    announcement,
    onSuccess,
    onCancel,
}: AnnouncementFormProps) {
    const isEditing = Boolean(announcement);
    const isChurchAnnouncement = type === 'church';

    const [selectedChurchId, setSelectedChurchId] = useState<string>(() => {
        if (churchId) return churchId;
        if (announcement && 'church_id' in announcement && announcement.church_id) {
            return announcement.church_id;
        }
        if (churches.length === 1) return churches[0].id;
        return '';
    });

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        isPinned: false,
        category: 'general' as AnnouncementCategory,
        scheduledAt: '',
        announcementType: 'info' as SystemAnnouncementType,
        expiresAt: '',
    });

    const [isScheduled, setIsScheduled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-fill form when editing
    useEffect(() => {
        if (announcement) {
            const churchAnn = announcement as ChurchAnnouncement;
            const sysAnn = announcement as SystemAnnouncement;
            const hasScheduled = Boolean(isChurchAnnouncement && churchAnn.scheduled_at);
            setIsScheduled(hasScheduled);
            setFormData({
                title: announcement.title || '',
                content: announcement.content || '',
                isPinned: isChurchAnnouncement ? Boolean(churchAnn.is_pinned) : false,
                category: isChurchAnnouncement ? (churchAnn.category || 'general') : 'general',
                scheduledAt: isChurchAnnouncement && churchAnn.scheduled_at
                    ? new Date(churchAnn.scheduled_at).toISOString().slice(0, 16)
                    : '',
                announcementType: !isChurchAnnouncement ? ((sysAnn.type as SystemAnnouncementType) || 'info') : 'info',
                expiresAt: !isChurchAnnouncement && sysAnn.expires_at
                    ? new Date(sysAnn.expires_at).toISOString().slice(0, 16)
                    : '',
            });
            if (isChurchAnnouncement && churchAnn.church_id) {
                setSelectedChurchId(churchAnn.church_id);
            }
        }
    }, [announcement, isChurchAnnouncement]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.title.trim()) { setError('Title is required'); return; }
        if (formData.title.length > 255) { setError('Title must be 255 characters or less'); return; }
        if (!formData.content.trim()) { setError('Content is required'); return; }

        const effectiveTargetChurchId = selectedChurchId || churchId;
        if (isChurchAnnouncement && !effectiveTargetChurchId) {
            setError('Please select a parish for this announcement');
            return;
        }

        setLoading(true);

        try {
            if (isChurchAnnouncement) {
                const targetChurch = churches.find(c => c.id === effectiveTargetChurchId);
                const resolvedChurchName = churchName || targetChurch?.name || 'Your followed church';

                if (isEditing && announcement) {
                    const { error: updateError } = await updateChurchAnnouncement(announcement.id, {
                        title: formData.title.trim(),
                        content: formData.content.trim(),
                        category: formData.category,
                        isPinned: formData.isPinned,
                        scheduledAt: isScheduled && formData.scheduledAt ? formData.scheduledAt : null,
                    });
                    if (updateError) throw updateError;
                } else {
                    const { error: createError } = await createChurchAnnouncement({
                        churchId: effectiveTargetChurchId!,
                        churchName: resolvedChurchName,
                        title: formData.title.trim(),
                        content: formData.content.trim(),
                        category: formData.category,
                        isPinned: formData.isPinned,
                        scheduledAt: isScheduled && formData.scheduledAt ? formData.scheduledAt : null,
                    });
                    if (createError) throw createError;
                }
            } else {
                if (isEditing && announcement) {
                    const { error: updateError } = await updateSystemAnnouncement(announcement.id, {
                        title: formData.title.trim(),
                        content: formData.content.trim(),
                        type: formData.announcementType,
                        expiresAt: formData.expiresAt || null,
                    });
                    if (updateError) throw updateError;
                } else {
                    const { error: createError } = await createSystemAnnouncement({
                        title: formData.title.trim(),
                        content: formData.content.trim(),
                        type: formData.announcementType,
                        expiresAt: formData.expiresAt || null,
                    });
                    if (createError) throw createError;
                }
            }

            onSuccess();
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to save announcement';
            console.error('Error saving announcement:', err);
            setError(errMessage);
        } finally {
            setLoading(false);
        }
    };

    const selectedCategory = CATEGORIES.find(c => c.value === formData.category) || CATEGORIES[0];

    return (
        <Modal
            isOpen={true}
            onClose={onCancel}
            title={`${isEditing ? 'Edit' : 'Create'} ${isChurchAnnouncement ? 'Church' : 'System'} Announcement`}
            size="2xl"
            bodyClassName="p-0"
        >
            <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                {/* Scrollable fields */}
                <div className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Parish selector (Church only, when churchId is not pre-fixed and churches are provided) */}
                    {isChurchAnnouncement && !churchId && churches.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">
                                Parish <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                <select
                                    value={selectedChurchId}
                                    onChange={(e) => setSelectedChurchId(e.target.value)}
                                    className="input w-full pl-9"
                                    required
                                >
                                    <option value="">Select a parish...</option>
                                    {churches.map((church) => (
                                        <option key={church.id} value={church.id}>
                                            {church.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">
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
                    </div>

                    {/* Category (Church only) */}
                    {isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-foreground">Category</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {CATEGORIES.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = formData.category === cat.value;
                                    return (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category: cat.value })}
                                            className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all text-left ${isSelected
                                                ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                                : 'border-border hover:bg-secondary-50 text-foreground'
                                                }`}
                                        >
                                            <Icon className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* System Type (System only) */}
                    {!isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-foreground">Type</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {SYSTEM_TYPES.map((typeOption) => {
                                    const isSelected = formData.announcementType === typeOption.value;
                                    return (
                                        <button
                                            key={typeOption.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, announcementType: typeOption.value })}
                                            className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${isSelected
                                                ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                                : 'border-border hover:bg-secondary-50 text-foreground'
                                                }`}
                                        >
                                            <span>{typeOption.icon}</span>
                                            <span>{typeOption.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-foreground">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="input w-full min-h-[120px] resize-y"
                            placeholder="Write your announcement message here..."
                            rows={5}
                            required
                        />
                    </div>

                    {/* Church-specific options */}
                    {isChurchAnnouncement && (
                        <div className="space-y-4 pt-2 border-t border-border">
                            {/* Pin Announcement */}
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isPinned}
                                    onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <div>
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                        <Pin className="w-3.5 h-3.5 text-primary" />
                                        Pin Announcement
                                    </div>
                                    <p className="text-xs text-muted">Pinned announcements appear at the top of the list</p>
                                </div>
                            </label>

                            {/* Schedule for later */}
                            <div className="space-y-2">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isScheduled}
                                        onChange={(e) => {
                                             setIsScheduled(e.target.checked);
                                            if (!e.target.checked) {
                                                setFormData({ ...formData, scheduledAt: '' });
                                            }
                                        }}
                                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                            <Clock className="w-3.5 h-3.5 text-muted" />
                                            Schedule for Later
                                        </div>
                                        <p className="text-xs text-muted">Publish this announcement at a specific future date and time</p>
                                    </div>
                                </label>

                                {isScheduled && (
                                    <div className="ml-7">
                                        <input
                                            type="datetime-local"
                                            value={formData.scheduledAt}
                                            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                            className="input w-full"
                                            min={new Date().toISOString().slice(0, 16)}
                                            required={isScheduled}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* System-specific: Expiration date */}
                    {!isChurchAnnouncement && (
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-foreground">Expiration Date (Optional)</label>
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
                            <div className="p-3 bg-secondary-50 rounded-xl border border-border">
                                <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Preview Badge</p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedCategory.color}`}>
                                    <SelIcon className="w-3.5 h-3.5" /> {selectedCategory.label}
                                </span>
                            </div>
                        );
                    })()}
                </div>

                {/* Sticky footer */}
                <div className="flex gap-3 p-4 sm:p-6 border-t border-border bg-secondary-50/50 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-100 text-foreground font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'} Announcement
                    </button>
                </div>
            </form>
        </Modal>
    );
}
