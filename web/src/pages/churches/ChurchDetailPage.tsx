import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { Building2, ArrowLeft, MapPin, Phone, Mail, Edit, Trash2, ExternalLink, Plus, Clock, Calendar, Heart } from 'lucide-react';
import { useChurch } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddScheduleModal from '../../components/churches/AddScheduleModal';
import EditScheduleModal from '../../components/churches/EditScheduleModal';
import FacebookFeed from '../../components/social/FacebookFeed';
import ImageLightbox from '../../components/churches/ImageLightbox';
import { AnnouncementsList, AnnouncementForm } from '../../components/announcements';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import type { ChurchAnnouncement } from '../../types/database';
import { Megaphone } from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import SubmitDonationModal from '../../components/donations/SubmitDonationModal';
import { getRecentDonors } from '../../lib/supabase/donations';
import { formatDistanceToNow } from 'date-fns';

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
    const [activeTab, setActiveTab] = useState<'sunday' | 'weekday'>('sunday');
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: ChurchAnnouncement | null }>({ show: false, announcement: null });
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [recentDonors, setRecentDonors] = useState<{ id: string; maskedName: string; created_at: string | null }[]>([]);
    const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);

    // Fetch church announcements
    const { announcements, loading: announcementsLoading, refetch: refetchAnnouncements } = useChurchAnnouncements(id);

    const getFilteredSchedules = () => {
        if (!church?.mass_schedules) return [];
        return church.mass_schedules.filter((s: any) => {
            const isSunday = s.day_of_week === 'Sunday';
            return activeTab === 'sunday' ? isSunday : !isSunday;
        }).sort((a: any, b: any) => {
            // Sort by time
            return a.time.localeCompare(b.time);
        });
    };

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

    // Fetch gallery images
    useEffect(() => {
        const fetchGallery = async () => {
            if (!id) return;
            try {
                const { data } = await supabase
                    .from('church_images')
                    .select('image_url')
                    .eq('church_id', id)
                    .order('display_order', { ascending: true });

                if (data) {
                    setGalleryImages(data.map((img: any) => img.image_url));
                }
            } catch (err) {
                console.error('Error fetching gallery:', err);
            }
        };

        fetchGallery();
    }, [id]);

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

    // const massSchedules = church?.mass_schedules || [];

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

                    <div className="flex gap-2 flex-wrap">
                        {/* Book Appointment (Visible to all logged in users) */}
                        <button
                            onClick={() => navigate(`/churches/${id}/book`)}
                            className="btn-primary"
                        >
                            <Calendar className="w-4 h-4" />
                            Book Appointment
                        </button>

                        {/* Donate button - visible if church has payment info */}
                        {(church.gcash_number || church.maya_number) && (
                            <button
                                onClick={() => {
                                    getRecentDonors(church.id).then(r => setRecentDonors(r.data || []));
                                    setShowDonateModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                            >
                                <Heart className="w-4 h-4" />
                                Donate
                            </button>
                        )}

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
            {/* Virtual Tour & Livestream */}
            {/* Virtual Tour & Livestream */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 360 Viewer */}
                {church.panorama_url && (
                    <div className="card p-0 overflow-hidden md:col-span-2">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary-50">
                            <h2 className="text-lg font-semibold flex items-center">
                                <Building2 className="w-5 h-5 text-primary mr-2" />
                                360° Virtual Tour
                            </h2>
                        </div>
                        <div style={{ height: '400px', width: '100%' }}>
                            <ReactPhotoSphereViewer
                                src={church.panorama_url}
                                height={'400px'}
                                width={"100%"}
                                container={""}
                            />
                        </div>
                    </div>
                )}

                {/* External Links Card */}
                {(church.livestream_url || (church.facebook_url && !church.facebook_url)) && (
                    <div className="card p-6 md:col-span-2">
                        <h2 className="text-lg font-semibold mb-4">Connect Online</h2>
                        <div className="flex flex-wrap gap-4">
                            {church.livestream_url && (
                                <a
                                    href={church.livestream_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <ExternalLink className="w-5 h-5 mr-2" />
                                    Watch Live Mass
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Donate / Recent Donors */}
            {(church.gcash_number || church.maya_number) && (
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Heart className="w-5 h-5 text-red-500" />
                            Support This Church
                        </h2>
                        <button
                            onClick={() => {
                                getRecentDonors(church.id).then(r => setRecentDonors(r.data || []));
                                setShowDonateModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                        >
                            <Heart className="w-4 h-4" />
                            Donate Now
                        </button>
                    </div>

                    {recentDonors.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs text-muted uppercase tracking-wide font-medium mb-3">Recent Generous Souls</p>
                            {recentDonors.map(donor => (
                                <div key={donor.id} className="flex items-center gap-2 text-sm">
                                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                        <Heart className="w-3.5 h-3.5 text-red-500" />
                                    </div>
                                    <span className="font-medium">{donor.maskedName}</span>
                                    <span className="text-muted">donated a kind amount</span>
                                    <span className="text-muted text-xs ml-auto">
                                        {donor.created_at ? formatDistanceToNow(new Date(donor.created_at), { addSuffix: true }) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted">
                            Be the first to donate and support this church community! 🙏
                        </p>
                    )}
                </div>
            )}

            {/* Main Content: Mass Schedules + Facebook Feed */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Column: Mass Schedules (flexible width) */}
                <div className="flex-1 min-w-0">
                    <div className="card p-6 h-full">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-lg font-semibold flex items-center">
                                    <Clock className="w-5 h-5 text-primary mr-2" />
                                    Mass Schedules
                                </h2>
                                <p className="text-sm text-muted">Join us in our celebrations</p>
                            </div>

                            {canManage() && (
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="btn-primary flex items-center w-full sm:w-auto justify-center"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Schedule
                                </button>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border mb-6">
                            <button
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sunday'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted hover:text-foreground'
                                    }`}
                                onClick={() => setActiveTab('sunday')}
                            >
                                Sunday Masses
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'weekday'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted hover:text-foreground'
                                    }`}
                                onClick={() => setActiveTab('weekday')}
                            >
                                Weekday & Saturday
                            </button>
                        </div>

                        {/* Schedule List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {getFilteredSchedules().length === 0 ? (
                                <div className="col-span-full text-center py-8 text-muted bg-secondary-50 rounded-lg border border-dashed border-secondary-200">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>No masses scheduled for this day type yet.</p>
                                </div>
                            ) : (
                                getFilteredSchedules().map((schedule: any) => (
                                    <div
                                        key={schedule.id}
                                        className="group relative flex items-center justify-between p-4 rounded-xl border border-secondary-100 bg-secondary-50/50 hover:bg-white hover:border-primary-100 hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-primary-100/50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <Clock className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-foreground">{formatTime(schedule.time)}</p>
                                                {schedule.language && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-200 text-secondary-800">
                                                        {schedule.language}
                                                    </span>
                                                )}
                                                <p className="text-xs text-muted mt-0.5">{schedule.day_of_week}</p>
                                            </div>
                                        </div>

                                        {canManage() && (
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingSchedule(schedule)}
                                                    className="p-1.5 text-secondary-500 hover:text-primary hover:bg-primary-50 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSchedule(schedule.id, schedule.day_of_week, formatTime(schedule.time))}
                                                    className="p-1.5 text-secondary-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Facebook Feed (fixed 500px width) */}
                {church.facebook_url && (
                    <div className="w-full lg:w-[500px] flex-shrink-0">
                        <FacebookFeed pageUrl={church.facebook_url} height={700} />
                    </div>
                )}
            </div>

            {/* Church Gallery */}
            {galleryImages.length > 0 && (
                <div className="card p-6">
                    <h2 className="text-lg font-semibold mb-4">Church Gallery</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {galleryImages.map((imageUrl, index) => (
                            <div
                                key={index}
                                className="relative group cursor-pointer overflow-hidden rounded-lg"
                                onClick={() => setLightboxIndex(index)}
                            >
                                <img
                                    src={imageUrl}
                                    alt={`${church.name} - Image ${index + 1}`}
                                    className="w-full h-48 object-cover transition-transform duration-200 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Church Announcements */}
            <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-primary" />
                            Church Announcements
                        </h2>
                        <p className="text-sm text-muted mt-1">Latest updates and news from this church</p>
                    </div>
                    {canManage() && (
                        <button
                            onClick={() => {
                                setEditingAnnouncement(null);
                                setShowAnnouncementForm(true);
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            New Announcement
                        </button>
                    )}
                </div>

                {announcementsLoading ? (
                    <div className="text-center py-8">
                        <p className="text-muted">Loading announcements...</p>
                    </div>
                ) : (
                    <AnnouncementsList
                        announcements={announcements}
                        type="church"
                        showActions={canManage()}
                        emptyMessage="No announcements have been posted yet. Check back later for updates!"
                        onEdit={(announcement) => {
                            setEditingAnnouncement(announcement as ChurchAnnouncement);
                            setShowAnnouncementForm(true);
                        }}
                        onDelete={(announcement) => {
                            setDeleteConfirmation({ show: true, announcement: announcement as ChurchAnnouncement });
                        }}

                    />
                )}
            </div>

            {/* Metadata */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Metadata</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted">Created:</span>
                        <p className="font-medium">{new Date(church.created_at || new Date().toISOString()).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <span className="text-muted">Last Updated:</span>
                        <p className="font-medium">{new Date(church.updated_at || new Date().toISOString()).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {
                showAddModal && (
                    <AddScheduleModal
                        churchId={id!}
                        onClose={() => setShowAddModal(false)}
                        onSuccess={() => {
                            refetch();
                            setShowAddModal(false);
                        }}
                    />
                )
            }

            {
                editingSchedule && (
                    <EditScheduleModal
                        schedule={editingSchedule}
                        onClose={() => setEditingSchedule(null)}
                        onSuccess={() => {
                            refetch();
                            setEditingSchedule(null);
                        }}
                    />
                )
            }

            {/* Lightbox */}
            {lightboxIndex !== null && (
                <ImageLightbox
                    images={galleryImages}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}

            {/* Announcement Form Modal */}
            {showAnnouncementForm && (
                <AnnouncementForm
                    type="church"
                    churchId={id!}
                    announcement={editingAnnouncement || undefined}
                    onSuccess={() => {
                        setShowAnnouncementForm(false);
                        setEditingAnnouncement(null);
                        refetchAnnouncements();
                    }}
                    onCancel={() => {
                        setShowAnnouncementForm(false);
                        setEditingAnnouncement(null);
                    }}
                />
            )}
            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmation.show}
                title="Delete Announcement"
                message={`Are you sure you want to delete "${deleteConfirmation.announcement?.title}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                loading={deletingAnnouncement}
                onConfirm={async () => {
                    if (!deleteConfirmation.announcement) return;
                    setDeletingAnnouncement(true);
                    try {
                        const { error } = await supabase
                            .from('church_announcements')
                            .delete()
                            .eq('id', deleteConfirmation.announcement.id);

                        if (error) throw error;
                        refetchAnnouncements();
                        setDeleteConfirmation({ show: false, announcement: null });
                    } catch (err: any) {
                        alert('Failed to delete announcement: ' + err.message);
                    } finally {
                        setDeletingAnnouncement(false);
                    }
                }}
                onCancel={() => setDeleteConfirmation({ show: false, announcement: null })}
            />

            {/* Donate Modal */}
            {showDonateModal && church && (
                <SubmitDonationModal
                    church={{
                        id: church.id,
                        name: church.name,
                        gcash_number: church.gcash_number,
                        maya_number: church.maya_number,
                        gcash_qr_url: church.gcash_qr_url,
                        maya_qr_url: church.maya_qr_url,
                    }}
                    onClose={() => setShowDonateModal(false)}
                    onSuccess={() => {
                        getRecentDonors(church.id).then(r => setRecentDonors(r.data || []));
                    }}
                />
            )}

        </div >

    );
}
