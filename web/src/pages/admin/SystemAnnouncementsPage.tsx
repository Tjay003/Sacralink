import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Megaphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import { AnnouncementsList, AnnouncementForm } from '../../components/announcements';
import { supabase } from '../../lib/supabase';
import type { SystemAnnouncement, ChurchAnnouncement } from '../../types/database';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

/**
 * SystemAnnouncementsPage - Manage system-wide announcements (Super Admin only)
 * 
 * Features:
 * - View all system announcements
 * - Create new system announcements
 * - Edit/Delete existing announcements
 * - Filter by type
 */
export default function SystemAnnouncementsPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { announcements, loading, refetch } = useSystemAnnouncements();

    const [showForm, setShowForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'info' | 'warning' | 'maintenance' | 'success'>('all');
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: SystemAnnouncement | ChurchAnnouncement | null }>({ show: false, announcement: null });
    const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);

    // Check if user is authorized
    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
        return (
            <div className="container mx-auto p-6">
                <div className="card p-8 text-center">
                    <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                    <p className="text-muted">You don't have permission to access this page.</p>
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
        : announcements.filter(a => a.type === filterType);

    const handleDelete = async (announcement: ChurchAnnouncement | SystemAnnouncement) => {
        setDeleteConfirmation({ show: true, announcement });
    };


    return (
        <div className="container mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Megaphone className="w-7 h-7 text-primary" />
                            System Announcements
                        </h1>
                        <p className="text-muted mt-1">
                            Manage app-wide announcements visible to all users
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setShowForm(true);
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Announcement
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="card p-4 mb-6">
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-secondary-100 text-foreground hover:bg-secondary-200'
                            }`}
                    >
                        All ({announcements.length})
                    </button>
                    <button
                        onClick={() => setFilterType('info')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === 'info'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            }`}
                    >
                        📘 Info ({announcements.filter(a => a.type === 'info').length})
                    </button>
                    <button
                        onClick={() => setFilterType('warning')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === 'warning'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            }`}
                    >
                        ⚠️ Warning ({announcements.filter(a => a.type === 'warning').length})
                    </button>
                    <button
                        onClick={() => setFilterType('maintenance')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === 'maintenance'
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                            }`}
                    >
                        🔧 Maintenance ({announcements.filter(a => a.type === 'maintenance').length})
                    </button>
                    <button
                        onClick={() => setFilterType('success')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === 'success'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                    >
                        ✅ Success ({announcements.filter(a => a.type === 'success').length})
                    </button>
                </div>
            </div>

            {/* Announcements List */}
            {loading ? (
                <div className="card p-8 text-center">
                    <p className="text-muted">Loading announcements...</p>
                </div>
            ) : (
                <AnnouncementsList
                    announcements={filteredAnnouncements}
                    type="system"
                    showActions
                    emptyMessage={
                        filterType === 'all'
                            ? 'No system announcements have been created yet.'
                            : `No ${filterType} announcements found.`
                    }
                    onEdit={(announcement) => {
                        setEditingAnnouncement(announcement as SystemAnnouncement);
                        setShowForm(true);
                    }}
                    onDelete={handleDelete}
                />
            )}

            {/* Announcement Form Modal */}
            {showForm && (
                <AnnouncementForm
                    type="system"
                    announcement={editingAnnouncement || undefined}
                    onSuccess={() => {
                        setShowForm(false);
                        setEditingAnnouncement(null);
                        refetch();
                    }}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingAnnouncement(null);
                    }}
                />
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
                        const { error } = await supabase
                            .from('system_announcements')
                            .delete()
                            .eq('id', deleteConfirmation.announcement.id);

                        if (error) throw error;
                        refetch();
                        setDeleteConfirmation({ show: false, announcement: null });
                    } catch (err: any) {
                        alert('Failed to delete announcement: ' + err.message);
                    } finally {
                        setDeletingAnnouncement(false);
                    }
                }}
                onCancel={() => setDeleteConfirmation({ show: false, announcement: null })}
            />
        </div>
    );
}
