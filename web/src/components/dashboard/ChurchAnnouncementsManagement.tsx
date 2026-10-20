import { useState, useMemo } from 'react';
import { Megaphone, Plus, Edit2, Trash2, Eye, Users, Pencil, Check, Loader2 } from 'lucide-react';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import AnnouncementForm from '../announcements/AnnouncementForm';
import ConfirmationModal from '../modals/ConfirmationModal';
import {
    deleteChurchAnnouncement,
    publishChurchAnnouncement,
    type ChurchAnnouncement,
} from '../../lib/supabase/announcements';

interface ChurchAnnouncementsManagementProps {
    churchId: string | null;
}

type ManagementTab = 'all' | 'published' | 'drafts';

/**
 * ChurchAnnouncementsManagement - Announcements and bulletin board widget
 * Aligned with the VolunteerDashboard mockup specifications.
 */
export default function ChurchAnnouncementsManagement({ churchId }: ChurchAnnouncementsManagementProps) {
    const { announcements, loading, refetch } = useChurchAnnouncements(churchId || undefined);
    const [activeTab, setActiveTab] = useState<ManagementTab>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | null>(null);
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: ChurchAnnouncement | null }>({
        show: false,
        announcement: null
    });
    const [deleting, setDeleting] = useState(false);

    // Helpers to identify scheduled/draft vs published
    const isScheduledOrDraft = (item: ChurchAnnouncement) => {
        return Boolean(item.scheduled_at && new Date(item.scheduled_at) > new Date());
    };

    const counts = useMemo(() => {
        const all = announcements.length;
        const published = announcements.filter((a) => !isScheduledOrDraft(a)).length;
        const drafts = announcements.filter((a) => isScheduledOrDraft(a)).length;
        return { all, published, drafts };
    }, [announcements]);

    // Filtered announcements based on active tab
    const displayedAnnouncements = useMemo(() => {
        if (activeTab === 'published') {
            return announcements.filter((a) => !isScheduledOrDraft(a));
        }
        if (activeTab === 'drafts') {
            return announcements.filter((a) => isScheduledOrDraft(a));
        }
        return announcements;
    }, [announcements, activeTab]);

    const handleEdit = (announcement: ChurchAnnouncement) => {
        setEditingAnnouncement(announcement);
        setShowForm(true);
    };

    const handlePublishNow = async (announcement: ChurchAnnouncement) => {
        try {
            setPublishingId(announcement.id);
            const { error } = await publishChurchAnnouncement(announcement.id);
            if (error) throw error;
            await refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to publish announcement';
            console.error('Failed to publish announcement:', err);
            alert('Failed to publish announcement: ' + message);
        } finally {
            setPublishingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirmation.announcement) return;

        try {
            setDeleting(true);
            const { error } = await deleteChurchAnnouncement(deleteConfirmation.announcement.id);

            if (error) throw error;

            await refetch();
            setDeleteConfirmation({ show: false, announcement: null });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete announcement';
            console.error('Failed to delete announcement:', err);
            alert('Failed to delete announcement: ' + message);
        } finally {
            setDeleting(false);
        }
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingAnnouncement(null);
        void refetch();
    };

    // Format relative or calendar date
    const formatPostedDate = (dateString?: string | null) => {
        if (!dateString) return 'recently';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatEditedDate = (dateString?: string | null) => {
        if (!dateString) return 'recently';
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return `today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (!churchId) {
        return null;
    }

    return (
        <>
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-foreground">Announcements and bulletin board</h3>
                        <p className="text-xs text-secondary-500 font-medium">What parishioners see on the parish page</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all text-xs font-semibold bg-primary hover:bg-primary-600 text-white shadow-xs cursor-pointer active:scale-95 shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New announcement</span>
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-secondary-100/70 rounded-xl w-fit mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <span>All</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            activeTab === 'all'
                                ? 'bg-blue-100 text-primary'
                                : 'bg-secondary-200/70 text-secondary-600'
                        }`}>
                            {counts.all}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('published')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'published'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <span>Published</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            activeTab === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-secondary-200/70 text-secondary-600'
                        }`}>
                            {counts.published}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('drafts')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'drafts'
                                ? 'bg-white text-foreground shadow-2xs'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <span>Drafts</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            activeTab === 'drafts'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-secondary-200/70 text-secondary-600'
                        }`}>
                            {counts.drafts}
                        </span>
                    </button>
                </div>

                {/* Announcements List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 bg-secondary-50/60 rounded-xl animate-pulse">
                                <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-secondary-200 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : displayedAnnouncements.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2.5">
                            <Megaphone className="w-6 h-6 text-amber-600" />
                        </div>
                        <p className="text-sm font-bold text-foreground">
                            {activeTab === 'drafts'
                                ? 'No drafts or scheduled announcements'
                                : activeTab === 'published'
                                ? 'No published announcements'
                                : 'No parish announcements yet'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-0.5">
                            {activeTab === 'drafts'
                                ? 'Announcements scheduled for later publication will appear here.'
                                : 'Post schedules, fiesta notices, or liturgical updates.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {displayedAnnouncements.map((announcement) => {
                            const isScheduled = isScheduledOrDraft(announcement);
                            const isPinned = Boolean(announcement.is_pinned);
                            const isPublishing = publishingId === announcement.id;

                            if (isScheduled) {
                                return (
                                    <div
                                        key={announcement.id}
                                        className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/25 flex items-center justify-between gap-3 transition-colors my-1 hover:bg-amber-50/40"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary-100 text-secondary-600 flex items-center justify-center shrink-0 border border-secondary-200/50">
                                                <Pencil className="w-4 h-4 text-secondary-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                        Draft
                                                    </span>

                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-50 text-secondary-600 border border-secondary-200">
                                                        {announcement.target_audience === 'parishioners' ? (
                                                            <>
                                                                <Users className="w-3 h-3" />
                                                                <span>Parishioners only</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="w-3 h-3" />
                                                                <span>Everyone</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>

                                                <h4 className="font-bold text-foreground text-sm line-clamp-1">
                                                    {announcement.title}
                                                </h4>
                                                <p className="text-xs text-secondary-500 font-medium mt-0.5">
                                                    Last edited {formatEditedDate(announcement.updated_at || announcement.created_at)}
                                                    {announcement.scheduled_at && ` · Scheduled for ${formatPostedDate(announcement.scheduled_at)}`}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handlePublishNow(announcement)}
                                                disabled={isPublishing}
                                                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                                            >
                                                {isPublishing ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5" />
                                                )}
                                                <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleEdit(announcement)}
                                                className="px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                <span>Edit</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirmation({ show: true, announcement })}
                                                title="Delete"
                                                className="p-1.5 rounded-xl border border-red-200/80 bg-white hover:bg-red-50 text-red-500 hover:text-red-600 shadow-2xs transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            // Published rows
                            return (
                                <div
                                    key={announcement.id}
                                    className="p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-3 hover:bg-secondary-50/50 transition-colors border border-transparent"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
                                            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {isPinned ? 'Published · Pinned' : 'Published'}
                                                </span>

                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-50 text-secondary-600 border border-secondary-200">
                                                    {announcement.target_audience === 'parishioners' ? (
                                                        <>
                                                            <Users className="w-3 h-3" />
                                                            <span>Parishioners only</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="w-3 h-3" />
                                                            <span>Everyone</span>
                                                        </>
                                                    )}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-foreground text-sm line-clamp-1">
                                                {announcement.title}
                                            </h4>
                                            <p className="text-xs text-secondary-500 font-medium mt-0.5">
                                                Posted {formatPostedDate(announcement.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(announcement)}
                                            className="px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmation({ show: true, announcement })}
                                            title="Delete"
                                            className="p-1.5 rounded-xl border border-red-200/80 bg-white hover:bg-red-50 text-red-500 hover:text-red-600 shadow-2xs transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Announcement Form Modal */}
            {showForm && (
                <AnnouncementForm
                    type="church"
                    churchId={churchId}
                    announcement={editingAnnouncement || undefined}
                    onSuccess={handleFormClose}
                    onCancel={handleFormClose}
                />
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmation.show}
                title="Delete Announcement"
                message={`Are you sure you want to delete "${deleteConfirmation.announcement?.title}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmation({ show: false, announcement: null })}
            />
        </>
    );
}
