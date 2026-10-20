import { useState } from 'react';
import { Megaphone, Plus, Edit2, Trash2 } from 'lucide-react';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import AnnouncementForm from '../announcements/AnnouncementForm';
import ConfirmationModal from '../modals/ConfirmationModal';
import {
    deleteChurchAnnouncement,
    type ChurchAnnouncement,
} from '../../lib/supabase/announcements';

interface ChurchAnnouncementsManagementProps {
    churchId: string | null;
}

/**
 * ChurchAnnouncementsManagement - Widget for managing church announcements
 * 
 * Features:
 * - Lists latest 5 announcements
 * - Create/Edit/Delete actions
 * - Links to church detail page
 */
export default function ChurchAnnouncementsManagement({ churchId }: ChurchAnnouncementsManagementProps) {
    const { announcements, loading, refetch } = useChurchAnnouncements(churchId || undefined);
    const [showForm, setShowForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: ChurchAnnouncement | null }>({
        show: false,
        announcement: null
    });
    const [deleting, setDeleting] = useState(false);

    // Latest 5 announcements
    const latestAnnouncements = announcements.slice(0, 5);

    const handleEdit = (announcement: ChurchAnnouncement) => {
        setEditingAnnouncement(announcement);
        setShowForm(true);
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

    if (!churchId) {
        return null;
    }

    return (
        <>
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/60">
                    <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">Parish announcements</h3>
                        <p className="text-xs text-secondary-500 font-medium">Fiesta alerts, bulletins and pastoral letters</p>
                    </div>

                    <button
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all text-xs font-semibold bg-primary hover:bg-primary/95 text-white shadow-xs cursor-pointer active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New announcement</span>
                    </button>
                </div>

                {/* Announcements List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-4 bg-secondary-50/60 rounded-xl animate-pulse">
                                <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-secondary-200 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : latestAnnouncements.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2.5">
                            <Megaphone className="w-6 h-6 text-amber-600" />
                        </div>
                        <p className="text-sm font-bold text-foreground">No parish announcements yet</p>
                        <p className="text-xs text-secondary-500 mt-0.5">Post schedules, fiesta notices, or liturgical updates.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {latestAnnouncements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className="group py-3.5 flex items-center justify-between gap-3 hover:bg-secondary-50/40 rounded-xl px-2 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 border border-amber-200/60">
                                        <Megaphone className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-foreground text-sm line-clamp-1">
                                            {announcement.title}
                                        </h4>
                                        <p className="text-xs text-secondary-500 font-medium">
                                            Posted {formatRelativeTime(announcement.created_at || new Date().toISOString())}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {announcement.is_pinned ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                            Pinned
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-700">
                                            General
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(announcement)}
                                            title="Edit"
                                            className="p-1 rounded-lg hover:bg-blue-50 text-secondary-400 hover:text-primary transition-colors cursor-pointer"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmation({ show: true, announcement })}
                                            title="Delete"
                                            className="p-1 rounded-lg hover:bg-red-50 text-secondary-400 hover:text-red-600 transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
