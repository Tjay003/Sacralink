import { useState, useEffect } from 'react';
import { Megaphone, Plus, Edit2, Trash2 } from 'lucide-react';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import AnnouncementForm from '../announcements/AnnouncementForm';
import ConfirmationModal from '../modals/ConfirmationModal';
import type { SystemAnnouncement } from '../../types/database';
import { supabase } from '../../lib/supabase';

/**
 * SystemAnnouncementsManagement - CRUD interface for system-wide announcements
 * 
 * Features:
 * - Create/Edit/Delete system announcements
 * - Set announcement type and expiration
 * - Preview announcements
 * - Latest 5 announcements displayed
 */
export default function SystemAnnouncementsManagement() {
    const { announcements, loading, refetch } = useSystemAnnouncements();
    const [showForm, setShowForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: SystemAnnouncement | null }>({
        show: false,
        announcement: null
    });
    const [deleting, setDeleting] = useState(false);

    // Latest 5 announcements
    const latestAnnouncements = announcements.slice(0, 5);

    const handleEdit = (announcement: SystemAnnouncement) => {
        setEditingAnnouncement(announcement);
        setShowForm(true);
    };

    const handleDelete = async () => {
        if (!deleteConfirmation.announcement) return;

        try {
            setDeleting(true);
            const { error } = await supabase
                .from('system_announcements')
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

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Get type badge colors
    const getTypeBadge = (type: string) => {
        const badges: Record<string, string> = {
            info: 'bg-blue-100 text-blue-800',
            warning: 'bg-yellow-100 text-yellow-800',
            maintenance: 'bg-orange-100 text-orange-800',
            success: 'bg-green-100 text-green-800',
        };
        return badges[type] || badges.info;
    };

    return (
        <>
            <div className="bg-card border rounded-lg p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">System Announcements</h3>
                            <p className="text-sm text-muted-foreground">Manage diocese-wide messages</p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setShowForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        New System Announcement
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
                    <div className="text-center py-8 text-muted-foreground">
                        <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No system announcements yet</p>
                        <p className="text-xs mt-1">Click "New System Announcement" to create one</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {latestAnnouncements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className="p-4 bg-background border rounded-lg hover:bg-muted transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-medium text-foreground line-clamp-1">
                                                {announcement.title}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(announcement.type)}`}>
                                                {announcement.type}
                                            </span>
                                            {!announcement.is_active && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span>Created {formatDate(announcement.created_at)}</span>
                                            {announcement.expires_at && (
                                                <span>Expires {formatDate(announcement.expires_at)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleEdit(announcement)}
                                            className="p-2 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmation({ show: true, announcement })}
                                            className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* View All Link */}
                {latestAnnouncements.length > 0 && announcements.length > 5 && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                        Showing {latestAnnouncements.length} of {announcements.length} announcements
                    </div>
                )}
            </div>

            {/* Announcement Form Modal */}
            {showForm && (
                <AnnouncementForm
                    type="system"
                    announcement={editingAnnouncement || undefined}
                    onSuccess={handleFormClose}
                    onCancel={handleFormClose}
                />
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmation.show}
                title="Delete System Announcement"
                message={`Are you sure you want to delete "${deleteConfirmation.announcement?.title}"? This will remove it from all users' views.`}
                confirmLabel="Delete"
                variant="danger"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmation({ show: false, announcement: null })}
            />
        </>
    );
}
