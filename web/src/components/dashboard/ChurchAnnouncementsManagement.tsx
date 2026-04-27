import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Plus, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import AnnouncementForm from '../announcements/AnnouncementForm';
import ConfirmationModal from '../modals/ConfirmationModal';
import type { ChurchAnnouncement } from '../../types/database';
import { supabase } from '../../lib/supabase';


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
    const navigate = useNavigate();
    const { announcements, loading, refetch } = useChurchAnnouncements(churchId || '');
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
            const { error } = await supabase
                .from('church_announcements')
                .delete()
                .eq('id', deleteConfirmation.announcement.id);

            if (error) throw error;

            refetch();
            setDeleteConfirmation({ show: false, announcement: null });
        } catch (err: any) {
            console.error('Failed to delete announcement:', err);
            alert('Failed to delete announcement: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingAnnouncement(null);
        refetch();
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
            <div className="bg-card border rounded-lg p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Church Announcements</h3>
                            <p className="text-sm text-gray-500">Manage your parish updates</p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        <Plus className="w-4 h-4" />
                        New Announcement
                    </button>
                </div>

                {/* Announcements List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
                                <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : latestAnnouncements.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Megaphone className="w-7 h-7 text-orange-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">No announcements yet</p>
                        <p className="text-xs mt-1 text-gray-400">Click "New Announcement" to create one</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {latestAnnouncements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className="group flex items-start justify-between gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-orange-200 hover:shadow-sm transition-all duration-200"
                            >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <h4 className="font-semibold text-gray-800 mb-0.5 line-clamp-1">
                                            {announcement.title}
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                            Posted {formatRelativeTime(announcement.created_at || new Date().toISOString())}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(announcement)}
                                        title="Edit"
                                        className="p-1.5 rounded-lg transition-colors hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmation({ show: true, announcement })}
                                        title="Delete"
                                        className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-gray-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* View All Link */}
                {latestAnnouncements.length > 0 && (
                    <button
                        onClick={() => navigate(`/churches/${churchId}`)}
                        className="mt-4 w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                    >
                        View all announcements
                        <ArrowRight className="w-4 h-4" />
                    </button>
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
