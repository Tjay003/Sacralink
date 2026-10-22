import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Info,
    AlertTriangle,
    Wrench,
    CheckCircle2,
    Clock,
    Pencil,
    Trash2,
    Send,
    X,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import {
    createSystemAnnouncement,
    updateSystemAnnouncement,
    deleteSystemAnnouncement,
    type SystemAnnouncement,
    type SystemAnnouncementType,
    type ChurchAnnouncement,
} from '../../lib/supabase/announcements';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import Modal from '../../components/ui/Modal';

const FILTER_OPTIONS: { id: 'all' | SystemAnnouncementType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'info', label: 'Info' },
    { id: 'warning', label: 'Warning' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'success', label: 'Success' },
];

const TYPE_CONFIG: Record<
    SystemAnnouncementType,
    {
        label: string;
        icon: typeof Info;
        iconContainerClass: string;
        badgeClass: string;
        previewBannerClass: string;
        previewTextClass: string;
    }
> = {
    maintenance: {
        label: 'Maintenance',
        icon: Wrench,
        iconContainerClass: 'bg-secondary-100 text-secondary-700',
        badgeClass: 'bg-secondary-100 text-secondary-700',
        previewBannerClass: 'bg-secondary-50 border-secondary-200 text-secondary-900',
        previewTextClass: 'text-secondary-600',
    },
    info: {
        label: 'Info',
        icon: Info,
        iconContainerClass: 'bg-blue-100 text-primary',
        badgeClass: 'bg-blue-100 text-blue-700',
        previewBannerClass: 'bg-blue-50 border-blue-200 text-blue-900',
        previewTextClass: 'text-blue-700',
    },
    success: {
        label: 'Success',
        icon: CheckCircle2,
        iconContainerClass: 'bg-emerald-100 text-emerald-700',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        previewBannerClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        previewTextClass: 'text-emerald-700',
    },
    warning: {
        label: 'Warning',
        icon: AlertTriangle,
        iconContainerClass: 'bg-amber-100 text-amber-700',
        badgeClass: 'bg-amber-100 text-amber-800',
        previewBannerClass: 'bg-amber-50 border-amber-200 text-amber-900',
        previewTextClass: 'text-amber-700',
    },
};

export default function SystemAnnouncementsPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { announcements, loading, refetch } = useSystemAnnouncements({ includeInactive: true });

    // Filter state
    const [filterType, setFilterType] = useState<'all' | SystemAnnouncementType>('all');

    // Panel & Edit state
    const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
    const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

    // Form fields
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [selectedType, setSelectedType] = useState<SystemAnnouncementType>('info');
    const [expiresAt, setExpiresAt] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        show: boolean;
        announcement: SystemAnnouncement | ChurchAnnouncement | null;
    }>({ show: false, announcement: null });
    const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);

    // Authorization guard
    if (!profile || profile.role !== 'super_admin') {
        return (
            <div className="space-y-6">
                <div className="card p-8 text-center max-w-md mx-auto">
                    <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted text-sm">You don't have permission to access this page.</p>
                    <button onClick={() => navigate('/')} className="btn-primary mt-4">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    // Filter announcements
    const filteredAnnouncements = filterType === 'all'
        ? announcements
        : announcements.filter((a) => a.type === filterType);

    // Pill count helper
    const getCountForFilter = (type: 'all' | SystemAnnouncementType) => {
        if (type === 'all') return announcements.length;
        return announcements.filter((a) => a.type === type).length;
    };

    // Open form for creating
    const handleStartCreate = () => {
        setEditingAnnouncement(null);
        setTitle('');
        setMessage('');
        setSelectedType('info');
        setExpiresAt('');
        setFormError('');
        setIsMobileModalOpen(true);
    };

    // Open form for editing
    const handleStartEdit = (announcement: SystemAnnouncement) => {
        setEditingAnnouncement(announcement);
        setTitle(announcement.title || '');
        setMessage(announcement.content || '');
        setSelectedType((announcement.type as SystemAnnouncementType) || 'info');
        setExpiresAt(
            announcement.expires_at
                ? new Date(announcement.expires_at).toISOString().slice(0, 16)
                : ''
        );
        setFormError('');
        setIsMobileModalOpen(true);
    };

    const handleCancelForm = () => {
        setEditingAnnouncement(null);
        setTitle('');
        setMessage('');
        setSelectedType('info');
        setExpiresAt('');
        setFormError('');
        setIsMobileModalOpen(false);
    };

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!title.trim()) {
            setFormError('Please enter a title');
            return;
        }
        if (!message.trim()) {
            setFormError('Please write a message');
            return;
        }

        setFormLoading(true);

        try {
            if (editingAnnouncement) {
                const { error } = await updateSystemAnnouncement(editingAnnouncement.id, {
                    title: title.trim(),
                    content: message.trim(),
                    type: selectedType,
                    expiresAt: expiresAt || null,
                });
                if (error) throw error;
            } else {
                const { error } = await createSystemAnnouncement({
                    title: title.trim(),
                    content: message.trim(),
                    type: selectedType,
                    expiresAt: expiresAt || null,
                });
                if (error) throw error;
            }

            await refetch();
            handleCancelForm();
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to save announcement';
            setFormError(errMsg);
        } finally {
            setFormLoading(false);
        }
    };

    // Format posted time
    const formatPostedTime = (dateString?: string | null) => {
        if (!dateString) return 'Posted recently';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Posted today';
        if (diffDays === 1) return 'Posted yesterday';
        if (diffDays < 7) return `Posted ${diffDays} days ago`;
        return `Posted ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    };

    // Format expiry time
    const formatExpiry = (expiresAtString?: string | null) => {
        if (!expiresAtString) return 'No expiry date set';
        const date = new Date(expiresAtString);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
        return `Expires ${formattedDate}, ${formattedTime}`;
    };

    // Form Component Content (Shared between Desktop Side Column & Mobile Modal)
    const renderFormContent = (isModal = false) => {
        const previewConfig = TYPE_CONFIG[selectedType] || TYPE_CONFIG.info;
        const PreviewIcon = previewConfig.icon;

        return (
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-foreground text-lg tracking-tight">
                            {editingAnnouncement ? 'Edit announcement' : 'New announcement'}
                        </h3>
                        <p className="text-xs text-secondary-500 mt-0.5">
                            See exactly how the banner will look before it goes live
                        </p>
                    </div>
                    {isModal && (
                        <button
                            type="button"
                            onClick={handleCancelForm}
                            className="p-1.5 text-secondary-400 hover:text-foreground rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                        {formError}
                    </div>
                )}

                {/* Type Selector (2x2 Grid) */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">
                        Announcement Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['info', 'warning', 'maintenance', 'success'] as SystemAnnouncementType[]).map((t) => {
                            const config = TYPE_CONFIG[t];
                            const IconComponent = config.icon;
                            const isSelected = selectedType === t;

                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setSelectedType(t)}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'border-primary bg-blue-50/60 text-primary font-semibold shadow-xs'
                                            : 'border-border bg-white text-secondary-600 hover:border-secondary-300 hover:bg-secondary-50/50'
                                    }`}
                                >
                                    <div
                                        className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            isSelected ? 'bg-primary text-white' : config.iconContainerClass
                                        }`}
                                    >
                                        <IconComponent className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs">{config.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Title */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Scheduled maintenance this Saturday"
                        maxLength={255}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                </div>

                {/* Message */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        Message
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write a short, clear message for parishioners and staff..."
                        rows={3}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-border rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                    />
                </div>

                {/* Audience (Placeholder/Future functionality) */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        Audience
                    </label>
                    <div className="relative">
                        <select
                            disabled
                            className="w-full px-3.5 py-2.5 text-sm bg-secondary-50 border border-border rounded-xl text-secondary-500 cursor-not-allowed appearance-none"
                        >
                            <option value="all">Everyone (All users & parishes)</option>
                        </select>
                        <Users className="w-4 h-4 text-secondary-400 absolute right-3.5 top-3 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-secondary-400 mt-1">
                        Audience targeting will be configurable in an upcoming release.
                    </p>
                </div>

                {/* Expiration Date (Optional) */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        Expires At <span className="text-secondary-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-border rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                </div>

                {/* Live Preview Box */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        Live Preview
                    </label>
                    <div
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${previewConfig.previewBannerClass}`}
                    >
                        <div className="mt-0.5 flex-shrink-0">
                            <PreviewIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold leading-tight">
                                {title.trim() || 'Scheduled maintenance this Saturday'}
                            </h5>
                            <p className="text-xs mt-1 leading-relaxed opacity-90 line-clamp-3">
                                {message.trim() ||
                                    'Our system will undergo scheduled routine database updates. All operations will resume shortly.'}
                            </p>
                            {expiresAt && (
                                <p className="text-[10px] mt-2 opacity-75 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatExpiry(expiresAt)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center gap-2">
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-blue-700 shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                    >
                        <Send className="w-4 h-4" />
                        {formLoading
                            ? 'Saving...'
                            : editingAnnouncement
                            ? 'Update announcement'
                            : 'Publish announcement'}
                    </button>
                    {editingAnnouncement && (
                        <button
                            type="button"
                            onClick={handleCancelForm}
                            className="py-2.5 px-3.5 rounded-xl text-sm font-medium text-secondary-600 bg-secondary-100 hover:bg-secondary-200 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl font-bold text-foreground tracking-tight">
                        System announcements
                    </h1>
                    <p className="text-sm text-secondary-500 font-medium mt-1">
                        App-wide banners shown to every parishioner, staff member and priest
                    </p>
                </div>

                {/* Mobile / Tablet "New Announcement" Trigger */}
                <button
                    onClick={handleStartCreate}
                    className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-blue-700 shadow-xs transition-colors self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" />
                    New announcement
                </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center">
                <div className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/60 border border-border/60 gap-1 overflow-x-auto scrollbar-none max-w-full">
                    {FILTER_OPTIONS.map((f) => {
                        const count = getCountForFilter(f.id);
                        const isActive = filterType === f.id;

                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilterType(f.id)}
                                className={
                                    isActive
                                        ? 'bg-white text-foreground font-bold shadow-xs border border-border/70 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer flex-shrink-0'
                                        : 'text-secondary-600 hover:text-foreground font-semibold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer flex-shrink-0'
                                }
                            >
                                <span>{f.label}</span>
                                <span
                                    className={
                                        isActive
                                            ? 'bg-blue-100 text-primary font-bold text-[11px] px-2 py-0.5 rounded-full'
                                            : 'bg-secondary-200/60 text-secondary-600 font-semibold text-[11px] px-2 py-0.5 rounded-full'
                                    }
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Two-Column Layout on Desktop / Single Column on Mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Announcements List */}
                <div className="lg:col-span-7 xl:col-span-7 space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="bg-white border border-border/80 rounded-2xl p-5 shadow-xs animate-pulse flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-secondary-100 flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-secondary-200/60 rounded w-1/3" />
                                        <div className="h-3.5 bg-secondary-100 rounded w-4/5" />
                                        <div className="h-3 bg-secondary-100 rounded w-1/4 pt-2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredAnnouncements.length === 0 ? (
                        <div className="bg-white border border-border/80 rounded-2xl p-12 text-center shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-secondary-100 text-secondary-400 flex items-center justify-center mx-auto mb-3">
                                <Info className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-foreground text-base">No announcements found</h4>
                            <p className="text-xs text-secondary-500 mt-1 max-w-sm mx-auto">
                                {filterType === 'all'
                                    ? 'No system announcements have been published yet.'
                                    : `There are currently no announcements matching the "${filterType}" filter.`}
                            </p>
                            <button
                                onClick={handleStartCreate}
                                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-blue-700"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Create your first announcement
                            </button>
                        </div>
                    ) : (
                        filteredAnnouncements.map((announcement) => {
                            const normalizedType =
                                (announcement.type as SystemAnnouncementType) || 'info';
                            const config = TYPE_CONFIG[normalizedType] || TYPE_CONFIG.info;
                            const IconComponent = config.icon;
                            const isBeingEdited = editingAnnouncement?.id === announcement.id;

                            return (
                                <div
                                    key={announcement.id}
                                    className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col gap-3 relative ${
                                        isBeingEdited
                                            ? 'border-primary ring-2 ring-primary/10'
                                            : 'border-border/80'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon Container */}
                                        <div
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${config.iconContainerClass}`}
                                        >
                                            <IconComponent className="w-5 h-5" />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span
                                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${config.badgeClass}`}
                                                >
                                                    {config.label}
                                                </span>
                                                <span className="text-xs text-secondary-400">
                                                    &bull;
                                                </span>
                                                <span className="text-xs text-secondary-500 font-medium">
                                                    {formatPostedTime(announcement.created_at)}
                                                </span>
                                                {!announcement.is_active && (
                                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary-100 text-secondary-600">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="font-bold text-foreground text-base tracking-tight mb-1">
                                                {announcement.title}
                                            </h4>

                                            <p className="text-xs sm:text-sm text-secondary-600 leading-relaxed line-clamp-2">
                                                {announcement.content}
                                            </p>

                                            {/* Expiry / Footer */}
                                            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-secondary-500 font-medium">
                                                <Clock className="w-3.5 h-3.5 text-secondary-400" />
                                                <span>{formatExpiry(announcement.expires_at)}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleStartEdit(announcement)}
                                                title="Edit announcement"
                                                className="w-9 h-9 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 flex items-center justify-center text-secondary-500 hover:text-primary transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDeleteConfirmation({
                                                        show: true,
                                                        announcement,
                                                    })
                                                }
                                                title="Delete announcement"
                                                className="w-9 h-9 rounded-xl border border-border/80 bg-white hover:bg-red-50 flex items-center justify-center text-secondary-500 hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Right Column: Side Component Form on Desktop (`lg:block`) */}
                <div className="hidden lg:block lg:col-span-5 xl:col-span-5">
                    <div className="bg-white border border-border/80 rounded-2xl p-6 shadow-xs sticky top-6">
                        {renderFormContent(false)}
                    </div>
                </div>
            </div>

            {/* Mobile / Tablet Modal (`lg:hidden`) */}
            {isMobileModalOpen && (
                <Modal
                    isOpen={isMobileModalOpen}
                    onClose={handleCancelForm}
                    size="lg"
                    showCloseButton={false}
                    bodyClassName="p-6"
                >
                    {renderFormContent(true)}
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmation.show}
                title="Delete System Announcement"
                message={`Are you sure you want to delete "${deleteConfirmation.announcement?.title}"? This will remove it from all users' view. This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                loading={deletingAnnouncement}
                onConfirm={async () => {
                    if (!deleteConfirmation.announcement) return;
                    setDeletingAnnouncement(true);
                    try {
                        const { error } = await deleteSystemAnnouncement(
                            deleteConfirmation.announcement.id
                        );
                        if (error) throw error;
                        await refetch();
                        if (editingAnnouncement?.id === deleteConfirmation.announcement.id) {
                            handleCancelForm();
                        }
                        setDeleteConfirmation({ show: false, announcement: null });
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        alert('Failed to delete announcement: ' + message);
                    } finally {
                        setDeletingAnnouncement(false);
                    }
                }}
                onCancel={() => setDeleteConfirmation({ show: false, announcement: null })}
            />
        </div>
    );
}
