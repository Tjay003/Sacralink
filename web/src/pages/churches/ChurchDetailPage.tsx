import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, MapPin, Phone, Mail, Edit, Trash2, ExternalLink, Plus, Clock, Calendar } from 'lucide-react';
import { useChurch } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddScheduleModal from '../../components/churches/AddScheduleModal';
import EditScheduleModal from '../../components/churches/EditScheduleModal';

/**
 * ChurchDetailPage - View details of a single church
 * 
 * Features:
 * - Display all church information
 * - Mass schedules management
 * - Edit button (navigate to edit page)
 * - Delete button (with confirmation)
 */
export default function ChurchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth(); // Added call to useAuth
    const { church, loading, error, refetch } = useChurch(id || '');

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any>(null);

    const handleDeleteSchedule = async (scheduleId: string, day: string, time: string) => {
        if (confirm(`Delete ${day} ${time} mass?`)) {
            try {
                const { error } = await supabase
                    .from('mass_schedules')
                    .delete()
                    .eq('id', scheduleId);

                if (error) {
                    console.error('❌ Error deleting schedule:', error);
                    alert('Failed to delete schedule');
                    return;
                }

                console.log('✅ Schedule deleted');
                refetch(); // Refresh church data
            } catch (err) {
                console.error('❌ Unexpected error:', err);
                alert('Failed to delete schedule');
            }
        }
    };

    const canManage = () => {
        if (!profile || !church) return false;
        if (profile.role === 'super_admin') return true;
        if ((profile.role === 'church_admin' || profile.role === 'volunteer') && profile.assigned_church_id === church.id) return true;
        if (profile.role === 'admin' && profile.church_id === church.id) return true;
        return false;
    };

    const isSuperAdmin = profile?.role === 'super_admin';

    // Format time from 24hr to 12hr
    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading church details...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !church) {
        return (
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/churches')}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Churches
                </button>
                <div className="card p-6">
                    <div className="text-center text-red-600">
                        <p className="font-semibold mb-2">Church not found</p>
                        <p className="text-sm">{error || 'This church does not exist'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const massSchedules = church?.mass_schedules || [];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/churches')}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Churches
                </button>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{church.name}</h1>
                            <p className="text-muted">Church Details</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {/* Book Appointment (Visible to all logged in users) */}
                        <button
                            onClick={() => navigate(`/churches/${id}/book`)}
                            className="btn-primary"
                        >
                            <Calendar className="w-4 h-4" />
                            Book Appointment
                        </button>

                        {/* Admin Action Buttons */}
                        {canManage() && (
                            <button
                                onClick={() => navigate(`/churches/${id}/edit`)}
                                className="btn-secondary"
                            >
                                <Edit className="w-4 h-4" />
                                Edit
                            </button>
                        )}

                        {isSuperAdmin && (
                            <button
                                onClick={async () => {
                                    if (confirm(`Are you sure you want to delete "${church.name}"?\n\nThis action cannot be undone and will also delete all associated mass schedules.`)) {
                                        console.log('🗑️ Deleting church:', id);

                                        if (!id) return;

                                        try {
                                            const { error } = await supabase
                                                .from('churches')
                                                .delete()
                                                .eq('id', id);

                                            if (error) {
                                                console.error('❌ Error deleting church:', error);
                                                alert('Failed to delete church: ' + error.message);
                                                return;
                                            }

                                            console.log('✅ Church deleted successfully');
                                            navigate('/churches');
                                        } catch (err) {
                                            console.error('❌ Unexpected error:', err);
                                            alert('Failed to delete church');
                                        }
                                    }
                                }}
                                className="btn-secondary text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Church Information */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Church Information</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Address</label>
                        <div className="flex items-start">
                            <MapPin className="w-4 h-4 text-muted mr-2 mt-1" />
                            <p className="text-foreground">{church.address}</p>
                        </div>
                    </div>

                    {church.contact_number && (
                        <div>
                            <label className="block text-sm font-medium text-muted mb-1">Contact Number</label>
                            <div className="flex items-center">
                                <Phone className="w-4 h-4 text-muted mr-2" />
                                <p className="text-foreground">{church.contact_number}</p>
                            </div>
                        </div>
                    )}

                    {church.email && (
                        <div>
                            <label className="block text-sm font-medium text-muted mb-1">Email</label>
                            <div className="flex items-center">
                                <Mail className="w-4 h-4 text-muted mr-2" />
                                <a href={`mailto:${church.email}`} className="text-primary hover:underline">
                                    {church.email}
                                </a>
                            </div>
                        </div>
                    )}

                    {church.description && (
                        <div>
                            <label className="block text-sm font-medium text-muted mb-1">Description</label>
                            <p className="text-foreground whitespace-pre-wrap">{church.description}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Virtual Tour & Livestream */}
            {(church.panorama_url || church.livestream_url) && (
                <div className="card p-6">
                    <h2 className="text-lg font-semibold mb-4">Virtual Experience</h2>
                    <div className="space-y-3">
                        {church.panorama_url && (
                            <a
                                href={church.panorama_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg hover:bg-secondary-100 transition-colors"
                            >
                                <div className="flex items-center">
                                    <Building2 className="w-5 h-5 text-primary mr-3" />
                                    <div>
                                        <p className="font-medium">360° Virtual Tour</p>
                                        <p className="text-sm text-muted">Explore the church virtually</p>
                                    </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted" />
                            </a>
                        )}

                        {church.livestream_url && (
                            <a
                                href={church.livestream_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg hover:bg-secondary-100 transition-colors"
                            >
                                <div className="flex items-center">
                                    <ExternalLink className="w-5 h-5 text-primary mr-3" />
                                    <div>
                                        <p className="font-medium">Live Mass Stream</p>
                                        <p className="text-sm text-muted">Watch live masses online</p>
                                    </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Mass Schedules */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Mass Schedules</h2>
                    {canManage() && ( // Conditional rendering for Add Schedule button
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-primary text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Schedule
                        </button>
                    )}
                </div>

                {massSchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No mass schedules yet</p>
                        <p className="text-sm mt-1">Click "Add Schedule" to create one</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-secondary-50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Day</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Language</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {massSchedules.map((schedule: any) => (
                                    <tr key={schedule.id} className="hover:bg-secondary-50">
                                        <td className="px-4 py-3 text-sm font-medium">{schedule.day_of_week}</td>
                                        <td className="px-4 py-3 text-sm">{formatTime(schedule.time)}</td>
                                        <td className="px-4 py-3 text-sm">{schedule.language || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-right">
                                            {canManage() && (
                                                <>
                                                    <button
                                                        onClick={() => setEditingSchedule(schedule)}
                                                        className="text-primary hover:underline mr-3"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSchedule(schedule.id, schedule.day_of_week, formatTime(schedule.time))}
                                                        className="text-red-600 hover:underline"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Metadata */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Metadata</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted">Created:</span>
                        <p className="font-medium">{new Date(church.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <span className="text-muted">Last Updated:</span>
                        <p className="font-medium">{new Date(church.updated_at).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <AddScheduleModal
                    churchId={id!}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        refetch();
                        setShowAddModal(false);
                    }}
                />
            )}

            {editingSchedule && (
                <EditScheduleModal
                    schedule={editingSchedule}
                    onClose={() => setEditingSchedule(null)}
                    onSuccess={() => {
                        refetch();
                        setEditingSchedule(null);
                    }}
                />
            )}
        </div>
    );
}
