import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { Building2, ArrowLeft, MapPin, Phone, Mail, Edit, Trash2, ExternalLink, Plus, Clock, Calendar, Heart, Bookmark, BookmarkCheck, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { useChurch, type MassSchedule } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddScheduleModal from '../../components/churches/AddScheduleModal';
import EditScheduleModal from '../../components/churches/EditScheduleModal';
import FacebookFeed from '../../components/social/FacebookFeed';
import ImageLightbox from '../../components/churches/ImageLightbox';
import { AnnouncementsList, AnnouncementForm } from '../../components/announcements';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import { deleteChurchAnnouncement, type ChurchAnnouncement } from '../../lib/supabase/announcements';
import { Megaphone } from 'lucide-react';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import Modal from '../../components/ui/Modal';
import SubmitDonationModal from '../../components/donations/SubmitDonationModal';
import { getRecentDonors } from '../../lib/supabase/donations';
import { formatDistanceToNow } from 'date-fns';
import { featureFlags, isFeatureEnabled } from '../../config/featureFlags';
import ChurchChatbot from '../../components/ai/ChurchChatbot';
import { followChurch, unfollowChurch, isChurchFollowed } from '../../lib/supabase/churchFavorites';
import VirtualSanctuarySection from '../../components/livestream/VirtualSanctuarySection';

interface SupporterRow {
    user_id: string;
    profiles: { id: string; full_name: string | null } | null;
}

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
    const { church, setChurch, loading, error, refetch } = useChurch(id || '');

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<MassSchedule | null>(null);
    const [activeTab, setActiveTab] = useState<'sunday' | 'weekday'>('sunday');
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: ChurchAnnouncement | null }>({ show: false, announcement: null });
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [recentDonors, setRecentDonors] = useState<{ id: string; maskedName: string; created_at: string | null }[]>([]);
    const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);
    const [supporters, setSupporters] = useState<{ id: string; full_name: string | null }[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [revokeReason, setRevokeReason] = useState('');
    const [revoking, setRevoking] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [searchParams] = useSearchParams();
    const deepLinkAnnouncementId = searchParams.get('announcement');

    // Load follow state + check for ?announcement= deep link
    useEffect(() => {
        if (id && profile) {
            isChurchFollowed(id).then(setIsFollowing);
        }
    }, [id, profile]);

    const handleFollowToggle = async () => {
        if (!id || !profile) return;
        setFollowLoading(true);
        if (isFollowing) {
            await unfollowChurch(id);
            setIsFollowing(false);
        } else {
            await followChurch(id);
            setIsFollowing(true);
        }
        setFollowLoading(false);
    };

    // Fetch church announcements
    const { announcements, loading: announcementsLoading, refetch: refetchAnnouncements } = useChurchAnnouncements(id);

    const getFilteredSchedules = (): MassSchedule[] => {
        if (!church?.mass_schedules) return [];
        return church.mass_schedules.filter((s: MassSchedule) => {
            const isSunday = s.day_of_week === 'Sunday';
            return activeTab === 'sunday' ? isSunday : !isSunday;
        }).sort((a: MassSchedule, b: MassSchedule) => {
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
        if (profile.role === 'admin' && profile.assigned_church_id === church.id) return true;
        return false;
    };

    const isSuperAdmin = profile?.role === 'super_admin';
    const isUnverified = Boolean(church && (church.status === 'unverified' || (Boolean(church.status) && church.status !== 'verified_active' && church.status !== 'active')));

    const handleRevokeVerification = async () => {
        if (!id || !church) return;
        setRevoking(true);
        try {
            const { error: updateError } = await supabase
                .from('churches')
                .update({ status: 'unverified' })
                .eq('id', id);

            if (updateError) throw updateError;

            if (profile?.id) {
                await supabase.from('activity_logs').insert({
                    user_id: profile.id,
                    action: 'revoke_parish_verification',
                    entity_type: 'churches',
                    entity_id: id,
                    metadata: { reason: revokeReason.trim() || 'No reason specified' },
                });
            }

            setChurch(prev => (prev ? { ...prev, status: 'unverified' } : prev));
            setShowRevokeModal(false);
            setRevokeReason('');
            setActionFeedback({
                type: 'success',
                message: `Cashless donations suspended and parish marked as Unverified for ${church.name}.`,
            });
        } catch (err: unknown) {
            console.error('❌ Error suspending parish verification:', err);
            setActionFeedback({
                type: 'error',
                message: 'Failed to suspend cashless donations. Please try again.',
            });
        } finally {
            setRevoking(false);
        }
    };

    const handleVerifyChurch = async () => {
        if (!id || !church) return;
        setVerifying(true);
        try {
            const { error: updateError } = await supabase
                .from('churches')
                .update({ status: 'verified_active' })
                .eq('id', id);

            if (updateError) throw updateError;

            if (profile?.id) {
                await supabase.from('activity_logs').insert({
                    user_id: profile.id,
                    action: 'verify_parish',
                    entity_type: 'churches',
                    entity_id: id,
                    metadata: { previous_status: church.status },
                });
            }

            setChurch(prev => (prev ? { ...prev, status: 'verified_active' } : prev));
            setActionFeedback({
                type: 'success',
                message: `Parish successfully verified! Cashless donations and sacramental features are now unlocked for ${church.name}.`,
            });
        } catch (err: unknown) {
            console.error('❌ Error verifying parish:', err);
            setActionFeedback({
                type: 'error',
                message: 'Failed to verify parish. Please try again.',
            });
        } finally {
            setVerifying(false);
        }
    };

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
                    setGalleryImages((data as { image_url: string }[]).map((img) => img.image_url));
                }
            } catch (err) {
                console.error('Error fetching gallery:', err);
            }
        };

        fetchGallery();
    }, [id]);

    // Fetch opted-in supporters
    useEffect(() => {
        const fetchSupporters = async () => {
            if (!id) return;
            const { data } = await supabase
                .from('donations')
                .select('user_id, profiles!donations_user_id_fkey(id, full_name)')
                .eq('church_id', id)
                .eq('status', 'verified')
                .eq('show_as_supporter', true);

            if (data) {
                // Deduplicate by user_id
                const seen = new Set<string>();
                const rows = data as unknown as SupporterRow[];
                const unique = rows
                    .filter((d) => d.profiles && !seen.has(d.user_id) && seen.add(d.user_id))
                    .map((d) => ({ id: d.user_id, full_name: d.profiles?.full_name || 'Anonymous' }));
                setSupporters(unique);
            }
        };
        fetchSupporters();
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
                    className="group flex items-center text-muted hover:text-foreground mb-4 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/churches')}
                    className="group flex items-center text-muted hover:text-foreground mb-4 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
                    Back to Churches
                </button>
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full lg:w-auto">
                        <div className="group/avatar relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center shrink-0 border border-border hover:border-primary/50 transition-all duration-300 hover:scale-105 shadow-xs hover:shadow-sm">
                            {church.featured_image_url
                                ? <img src={church.featured_image_url} alt={church.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/avatar:scale-105" />
                                : <Building2 className="w-8 h-8 text-primary transition-transform duration-300 group-hover/avatar:scale-110" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-bold truncate text-foreground">{church.name}</h1>
                                {church.status === 'unverified' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 shrink-0">
                                        <Clock className="w-3.5 h-3.5" />
                                        Verification Pending
                                    </span>
                                )}
                                {(church.status === 'verified_active' || church.status === 'active') && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Verified Parish
                                    </span>
                                )}
                            </div>
                            <p className="text-muted truncate text-xs sm:text-sm">Church Details</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto py-0.5 shrink-0">
                        {/* Book Appointment */}
                        {isFeatureEnabled('appointments') && (
                            <button
                                onClick={() => navigate(`/churches/${id}/book`)}
                                className="btn-primary flex flex-col items-center justify-center rounded-lg px-4 py-2 shrink-0 cursor-pointer hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shadow-xs hover:shadow-md"
                            >
                                <Calendar className="w-4 h-4 shrink-0 mb-1" />
                                <span className="text-xs truncate">Book Appointment</span>
                            </button>
                        )}

                        {/* Donate button - visible if church has payment info */}
                        {(church.gcash_number || church.maya_number) && (
                            <button
                                onClick={() => {
                                    if (isUnverified) return;
                                    getRecentDonors(church.id).then(r => setRecentDonors(r.data || []));
                                    setShowDonateModal(true);
                                }}
                                disabled={Boolean(isUnverified)}
                                title={isUnverified ? 'Donations locked until Diocese verification' : 'Donate to this church'}
                                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 shrink-0 ${
                                    isUnverified
                                        ? 'bg-secondary-200 dark:bg-secondary-800 text-muted cursor-not-allowed opacity-60'
                                        : 'bg-red-500 hover:bg-red-600 text-white cursor-pointer hover:-translate-y-0.5 active:scale-95 shadow-xs hover:shadow-md'
                                }`}
                            >
                                <Heart className="w-4 h-4 shrink-0" />
                                <span className="text-xs">{isUnverified ? 'Locked' : 'Donate'}</span>
                            </button>
                        )}

                        {/* Follow / Unfollow button — for regular users */}
                        {profile && (
                            <button
                                onClick={handleFollowToggle}
                                disabled={followLoading}
                                title={isFollowing ? 'Unfollow this church' : 'Follow to get notified of announcements'}
                                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 border shrink-0 cursor-pointer hover:-translate-y-0.5 active:scale-95 shadow-xs hover:shadow-md ${
                                    isFollowing
                                        ? 'bg-primary text-white border-primary hover:bg-primary/90'
                                        : 'bg-white dark:bg-card text-foreground border-border hover:border-primary hover:text-primary'
                                } disabled:opacity-60`}
                            >
                                {isFollowing
                                    ? <BookmarkCheck className="w-4 h-4 shrink-0" />
                                    : <Bookmark className="w-4 h-4 shrink-0" />}
                                <span className="text-xs">{isFollowing ? 'Following' : 'Follow'}</span>
                            </button>
                        )}

                        {/* Super Admin Parish Verification Security Controls */}
                        {isSuperAdmin && (
                            (church.status === 'verified_active' || church.status === 'active') ? (
                                <button
                                    onClick={() => setShowRevokeModal(true)}
                                    className="flex flex-col items-center justify-center gap-1 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 bg-amber-500 hover:bg-amber-600 text-white shadow-xs hover:shadow-md cursor-pointer active:scale-95 shrink-0"
                                >
                                    <ShieldAlert className="w-4 h-4 shrink-0" />
                                    <span>Suspend Donations</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleVerifyChurch}
                                    disabled={verifying}
                                    className="flex flex-col items-center justify-center gap-1 px-3.5 py-2 rounded-lg font-semibold text-xs transition-all duration-200 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md cursor-pointer active:scale-95 shrink-0 disabled:opacity-60"
                                >
                                    <ShieldCheck className="w-4 h-4 shrink-0" />
                                    <span>{verifying ? 'Verifying...' : 'Verify Parish'}</span>
                                </button>
                            )
                        )}

                        {/* Admin Action Buttons */}
                        {canManage() && (
                            <button
                                onClick={() => navigate(`/churches/${id}/edit`)}
                                className="btn-secondary flex flex-col items-center justify-center rounded-lg px-3 py-1.5 shrink-0 cursor-pointer hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shadow-xs hover:shadow-md"
                            >
                                <Edit className="w-4 h-4 shrink-0 mb-1" />
                                <span className="text-xs">Edit</span>
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
                                className="btn-secondary text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex flex-col items-center justify-center px-3 py-1.5 shrink-0 cursor-pointer hover:-translate-y-0.5 active:scale-95 transition-all duration-200 shadow-xs hover:shadow-md"
                            >
                                <Trash2 className="w-4 h-4 shrink-0 mb-1" />
                                <span className="text-xs">Delete</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Feedback Banner */}
            {actionFeedback && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xs ${
                        actionFeedback.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        {actionFeedback.type === 'success' ? (
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                        <p className="text-sm font-medium">{actionFeedback.message}</p>
                    </div>
                    <button
                        onClick={() => setActionFeedback(null)}
                        className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer text-current opacity-70 hover:opacity-100"
                        aria-label="Dismiss banner"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Church Information */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Church Information</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted mb-1">Address & Coordinates</label>
                        <div className="flex items-start justify-between flex-wrap gap-2">
                            <div className="flex items-start">
                                <MapPin className="w-4 h-4 text-muted mr-2 mt-1 shrink-0" />
                                <div>
                                    <p className="text-foreground">{church.address}</p>
                                    {church.latitude !== null && church.longitude !== null && (
                                        <p className="text-xs text-muted mt-0.5 font-mono">
                                            📍 Coordinates: {church.latitude?.toFixed(6)}°, {church.longitude?.toFixed(6)}°
                                        </p>
                                    )}
                                </div>
                            </div>
                            {church.latitude !== null && church.longitude !== null && (
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${church.latitude}&mlon=${church.longitude}#map=17/${church.latitude}/${church.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View on OpenStreetMap
                                </a>
                            )}
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
                        <div style={{ height: '400px', width: '100%', isolation: 'isolate', position: 'relative' }}>
                            <ReactPhotoSphereViewer
                                src={church.panorama_url}
                                height={'400px'}
                                width={"100%"}
                                container={""}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Virtual Sanctuary (Universal Stream Player & Sacramental Companion) */}
            <VirtualSanctuarySection church={church} />

            {/* Donate / Recent Donors or Verification Pending Banner */}
            {isUnverified ? (
                <div className="card p-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-600 rounded-xl shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                                    Cashless Donations Locked — Verification Pending
                                </h3>
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                    Anti-Fraud Gate
                                </span>
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                                This parish is currently undergoing Diocese anti-fraud and clergy credentials verification. In accordance with Diocese financial integrity policies, cashless donations (GCash/Maya) and QR code displays are locked until manual verification is complete.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                (church.gcash_number || church.maya_number) && (
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
                )
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
                                    className="btn-primary flex items-center w-full sm:w-auto justify-center rounded-lg px-4 py-2"
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
                        <div 
                            className="grid gap-4" 
                            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                        >
                            {getFilteredSchedules().length === 0 ? (
                                <div className="col-span-full text-center py-8 text-muted bg-secondary-50 rounded-lg border border-dashed border-secondary-200">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>No masses scheduled for this day type yet.</p>
                                </div>
                            ) : (
                                getFilteredSchedules().map((schedule) => (
                                    <div
                                        key={schedule.id}
                                        className="group relative flex items-center justify-between p-4 rounded-xl border border-secondary-100 bg-secondary-50/50 hover:bg-white hover:border-primary-100 hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 pr-8">
                                            <div className="w-12 h-12 rounded-full bg-primary-100/50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <Clock className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-lg font-bold text-foreground truncate">{formatTime(schedule.time)}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {schedule.language && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary-200 text-secondary-800 shrink-0">
                                                            {schedule.language}
                                                        </span>
                                                    )}
                                                    <p className="text-xs text-muted truncate">{schedule.day_of_week}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {canManage() && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md shadow-sm p-0.5 border border-secondary-100">
                                                <button
                                                    onClick={() => setEditingSchedule(schedule)}
                                                    className="p-1 text-secondary-500 hover:text-primary hover:bg-primary-50 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSchedule(schedule.id, schedule.day_of_week, formatTime(schedule.time))}
                                                    className="p-1 text-secondary-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                    <div className="w-full">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Megaphone className="w-5 h-5 text-primary shrink-0" />
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
                            className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 shrink-0 w-full sm:w-auto justify-center"
                        >
                            <Plus className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">New Announcement</span>
                            <span className="sm:hidden">New Announcement</span>
                        </button>
                    )}
                </div>

                {announcementsLoading ? (
                    <div className="card p-6 text-center">
                        <p className="text-muted">Loading announcements...</p>
                    </div>
                ) : (
                    <AnnouncementsList
                        announcements={announcements}
                        type="church"
                        showActions={canManage()}
                        emptyMessage="No announcements have been posted yet. Check back later for updates!"
                        initialOpenId={deepLinkAnnouncementId ?? undefined}
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

            {/* Church Supporters */}
            {supporters.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Heart className="w-5 h-5 text-rose-500 fill-rose-300" />
                        <h2 className="text-lg font-semibold">Church Supporters</h2>
                        <span className="ml-auto text-xs text-muted bg-muted/10 px-2 py-0.5 rounded-full">
                            {supporters.length} {supporters.length === 1 ? 'supporter' : 'supporters'}
                        </span>
                    </div>
                    <p className="text-sm text-muted mb-4">These parishioners have generously supported this church.</p>
                    <div className="flex flex-wrap gap-2">
                        {supporters.map((s) => (
                            <span
                                key={s.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-sm font-medium border border-rose-100"
                            >
                                <Heart className="w-3 h-3 fill-rose-300 text-rose-400" />
                                {s.full_name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

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
                    churchName={church?.name}
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
                        const { error } = await deleteChurchAnnouncement(deleteConfirmation.announcement.id);

                        if (error) throw error;
                        await refetchAnnouncements();
                        setDeleteConfirmation({ show: false, announcement: null });
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Failed to delete announcement';
                        alert('Failed to delete announcement: ' + message);
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

            {/* Modal for Revoking Parish Verification */}
            {church && (
                <Modal
                    isOpen={showRevokeModal}
                    onClose={() => {
                        if (!revoking) {
                            setShowRevokeModal(false);
                            setRevokeReason('');
                        }
                    }}
                    title={
                        <div className="flex items-center gap-2 text-amber-600">
                            <ShieldAlert className="w-5 h-5 shrink-0" />
                            <span className="text-base sm:text-lg font-bold text-foreground">
                                Suspend Cashless Donations for {church.name}?
                            </span>
                        </div>
                    }
                    size="md"
                    footer={
                        <div className="flex items-center justify-end gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRevokeModal(false);
                                    setRevokeReason('');
                                }}
                                disabled={revoking}
                                className="px-4 py-2.5 rounded-xl border border-border bg-white dark:bg-card hover:bg-secondary-50 text-foreground text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeVerification}
                                disabled={revoking}
                                className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs hover:shadow-md disabled:opacity-50 flex items-center gap-2"
                            >
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>{revoking ? 'Suspending...' : 'Suspend Cashless Donations'}</span>
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-relaxed">
                            This will immediately mark the church as Unverified and lock GCash and Maya cashless donation gates across web and mobile. Use this if the church admin account is compromised, under diocesan inquiry, or undergoing chancery credential audits.
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Reason for Suspension <span className="text-muted font-normal">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="e.g. Security inquiry, Credential audit"
                                disabled={revoking}
                                className="input w-full text-sm"
                            />
                            <p className="text-[11px] text-muted mt-1">
                                This reason will be recorded in audit activity logs for chancery compliance.
                            </p>
                        </div>
                    </div>
                </Modal>
            )}

            {/* AI Parish Assistant Chatbot - floating widget */}
            {featureFlags.parishionerChatbot.enabled && (
                <ChurchChatbot churchId={church.id} churchName={church.name} />
            )}

        </div>

    );
}
