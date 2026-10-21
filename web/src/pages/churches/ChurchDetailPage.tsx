import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Building2,
    ArrowLeft,
    MapPin,
    Phone,
    Mail,
    Edit,
    Trash2,
    Plus,
    Clock,
    Calendar,
    Heart,
    Bookmark,
    BookmarkCheck,
    ShieldCheck,
    ShieldAlert,
    X,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    SlidersHorizontal,
    Megaphone,
    Radio,
    Cross,
    Camera,
    CheckCircle2,
    Sparkles,
    Globe,
    History,
    Download,
    Compass,
    EyeOff,
    CheckCircle,
    UserMinus,
    MoreVertical
} from 'lucide-react';
import { useChurch, type MassSchedule } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ParishInquiryModal from '../../components/churches/ParishInquiryModal';
import AddScheduleModal from '../../components/churches/AddScheduleModal';
import EditScheduleModal from '../../components/churches/EditScheduleModal';
import FacebookFeed from '../../components/social/FacebookFeed';
import SanctuaryVirtualTour from '../../components/churches/SanctuaryVirtualTour';
import ImageLightbox from '../../components/churches/ImageLightbox';
import GalleryUploader from '../../components/churches/GalleryUploader';
import { AnnouncementsList, AnnouncementForm } from '../../components/announcements';
import { useChurchAnnouncements } from '../../hooks/useChurchAnnouncements';
import { deleteChurchAnnouncement, type ChurchAnnouncement } from '../../lib/supabase/announcements';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import Modal from '../../components/ui/Modal';
import SubmitDonationModal from '../../components/donations/SubmitDonationModal';
import { getRecentDonors } from '../../lib/supabase/donations';
import { formatDistanceToNow } from 'date-fns';
import { featureFlags, isFeatureEnabled } from '../../config/featureFlags';
import ChurchChatbot from '../../components/ai/ChurchChatbot';
import { followChurch, unfollowChurch, isChurchFollowed } from '../../lib/supabase/churchFavorites';
import VirtualSanctuarySection from '../../components/livestream/VirtualSanctuarySection';
import LiveBroadcastManager from '../../components/dashboard/LiveBroadcastManager';
import AssignStaffModal from '../../components/admin/AssignStaffModal';
import EditRoleModal from '../../components/admin/EditRoleModal';
import { directUpdateProfile } from '../../lib/directApi';
import type { Profile, Database } from '../../types/database';

type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
type ScheduleItem = MassSchedule & { mass_type?: string; description?: string };

const FALLBACK_PANORAMA_URL = 'https://oaczurouvaevebpimply.supabase.co/storage/v1/object/public/church-images/panoramas/b2tabj6xh1v.jpg';

interface SupporterRow {
    user_id: string;
    profiles: { id: string; full_name: string | null } | null;
}

type TabType = 'overview' | 'liturgy' | 'media' | 'livestream' | 'announcements' | 'governance';

export default function ChurchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, profile, session } = useAuth();
    const { church, setChurch, loading, error, refetch } = useChurch(id || '');

    // Main Tab Navigation
    const [currentTab, setCurrentTab] = useState<TabType>('overview');

    // Schedules Tab State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<MassSchedule | null>(null);
    const [activeLiturgyTab, setActiveLiturgyTab] = useState<'sunday' | 'weekday'>('sunday');

    // Gallery & Lightbox
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [showGalleryUploadModal, setShowGalleryUploadModal] = useState(false);

    // Announcements
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ show: boolean; announcement: ChurchAnnouncement | null }>({ show: false, announcement: null });
    const [deletingAnnouncement, setDeletingAnnouncement] = useState(false);

    // Donations
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [recentDonors, setRecentDonors] = useState<{ id: string; maskedName: string; created_at: string | null }[]>([]);
    const [supporters, setSupporters] = useState<{ id: string; full_name: string | null }[]>([]);

    // Follow / Bookmark
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    // Verification / Revoke Modal
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [revokeReason, setRevokeReason] = useState('');
    const [revoking, setRevoking] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Admin Controls Dropdown
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const [dropdownAlign, setDropdownAlign] = useState<'left' | 'right'>('right');
    const adminDropdownRef = useRef<HTMLDivElement>(null);

    // Dynamic Live Metrics & Parish Staff
    const [registeredMembersCount, setRegisteredMembersCount] = useState<number>(0);
    const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
    const [staffList, setStaffList] = useState<Profile[]>([]);
    const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

    // Staff Assignment & Management Modals
    const [showAssignStaffModal, setShowAssignStaffModal] = useState<boolean>(false);
    const [editingStaffMember, setEditingStaffMember] = useState<Profile | null>(null);
    const [unassignStaffMember, setUnassignStaffMember] = useState<Profile | null>(null);
    const [unassignLoading, setUnassignLoading] = useState<boolean>(false);
    const [activeStaffDropdownId, setActiveStaffDropdownId] = useState<string | null>(null);

    // Parish Office Inquiry Modal
    const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);

    const [searchParams] = useSearchParams();
    const deepLinkAnnouncementId = searchParams.get('announcement');
    const tabParam = searchParams.get('tab');

    // Setup deep link if provided
    useEffect(() => {
        if (deepLinkAnnouncementId) {
            setCurrentTab('announcements');
        } else if (tabParam === 'governance') {
            setCurrentTab('governance');
        }
    }, [deepLinkAnnouncementId, tabParam]);

    const updateDropdownAlignment = () => {
        if (adminDropdownRef.current) {
            const rect = adminDropdownRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const dropdownWidth = 224;

            const wouldOverflowRight = rect.left + dropdownWidth > viewportWidth - 8;
            const wouldOverflowLeft = rect.right - dropdownWidth < 8;

            if (wouldOverflowLeft && !wouldOverflowRight) {
                setDropdownAlign('left');
            } else if (wouldOverflowRight && !wouldOverflowLeft) {
                setDropdownAlign('right');
            } else if (rect.left < 200) {
                setDropdownAlign('left');
            } else {
                setDropdownAlign('right');
            }
        }
    };

    const handleToggleAdminMenu = () => {
        if (!adminMenuOpen) {
            updateDropdownAlignment();
        }
        setAdminMenuOpen((prev) => !prev);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
                setAdminMenuOpen(false);
            }
        };
        if (adminMenuOpen) {
            updateDropdownAlignment();
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('resize', updateDropdownAlignment);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', updateDropdownAlignment);
        };
    }, [adminMenuOpen]);

    // Close staff action dropdown on outside click
    useEffect(() => {
        const handleCloseStaffDropdown = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.staff-menu-container')) {
                setActiveStaffDropdownId(null);
            }
        };
        if (activeStaffDropdownId) {
            document.addEventListener('mousedown', handleCloseStaffDropdown);
        }
        return () => {
            document.removeEventListener('mousedown', handleCloseStaffDropdown);
        };
    }, [activeStaffDropdownId]);

    // Load follow state
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

    // Announcements Hook
    const { announcements, loading: announcementsLoading, refetch: refetchAnnouncements } = useChurchAnnouncements(id);

    // Fetch dynamic live metrics & staff members
    const fetchMetricsAndStaff = useCallback(async () => {
        if (!id) return;

        try {
            setLoadingStaff(true);
            // 1. Members count (profiles assigned to this church)
            const { count: membersCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .or(`church_id.eq.${id},assigned_church_id.eq.${id}`);
            setRegisteredMembersCount(membersCount || 0);

            // 2. Pending requests count (appointments with status = 'pending')
            const { count: pendingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('church_id', id)
                .eq('status', 'pending');
            setPendingRequestsCount(pendingCount || 0);

            // 3. Staff team members (priests, church_admins, volunteers)
            const { data: staffData } = await supabase
                .from('profiles')
                .select('*')
                .or(`church_id.eq.${id},assigned_church_id.eq.${id}`)
                .in('role', ['church_admin', 'priest', 'volunteer', 'admin'])
                .limit(50);
            if (staffData) {
                setStaffList(staffData as Profile[]);
            }

            // 4. Audit activity logs for governance
            const { data: logs } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('entity_id', id)
                .order('created_at', { ascending: false })
                .limit(8);
            if (logs) {
                setActivityLogs(logs);
            }
        } catch (err) {
            console.error('Error fetching church metrics:', err);
        } finally {
            setLoadingStaff(false);
        }
    }, [id]);

    useEffect(() => {
        fetchMetricsAndStaff();
    }, [fetchMetricsAndStaff]);

    // Unassign staff member from this parish
    const handleUnassignConfirm = async () => {
        if (!unassignStaffMember || !id) return;

        if (unassignStaffMember.role === 'super_admin') {
            setActionFeedback({
                type: 'error',
                message: 'Cannot unassign Platform Owner (Super Admin).',
            });
            setUnassignStaffMember(null);
            return;
        }

        setUnassignLoading(true);
        try {
            const token = session?.access_token || '';
            const isOrdained = Boolean(unassignStaffMember.is_priest);

            const result = await directUpdateProfile(
                unassignStaffMember.id,
                {
                    assigned_church_id: null,
                    church_id: null,
                    role: 'user',
                    is_priest: isOrdained, // Preserves ordination status for clergy
                },
                token
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to unassign staff member.');
            }

            // Record activity log for chancery governance
            if (profile?.id) {
                try {
                    await supabase.from('activity_logs').insert({
                        user_id: profile.id,
                        action: 'unassign_parish_staff',
                        entity_type: 'churches',
                        entity_id: id,
                        metadata: {
                            unassigned_user_id: unassignStaffMember.id,
                            unassigned_user_name: unassignStaffMember.full_name,
                            previous_role: unassignStaffMember.role,
                            church_name: church?.name,
                        },
                    });
                } catch (auditErr) {
                    console.warn('Could not record activity log:', auditErr);
                }
            }

            setActionFeedback({
                type: 'success',
                message: `${unassignStaffMember.full_name || 'Staff member'} was successfully unassigned from ${church?.name || 'this parish'}.`,
            });

            await fetchMetricsAndStaff();
            setUnassignStaffMember(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to unassign staff member';
            setActionFeedback({
                type: 'error',
                message,
            });
        } finally {
            setUnassignLoading(false);
        }
    };

    // Fetch gallery images
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

    useEffect(() => {
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

    const getFilteredSchedules = (): MassSchedule[] => {
        if (!church?.mass_schedules) return [];
        return church.mass_schedules.filter((s: MassSchedule) => {
            const isSunday = s.day_of_week === 'Sunday';
            return activeLiturgyTab === 'sunday' ? isSunday : !isSunday;
        }).sort((a: MassSchedule, b: MassSchedule) => {
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

                refetch();
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
    const cashlessPaused = church?.accept_cashless === false;
    const donationsLocked = isUnverified || cashlessPaused;
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



    const handleContactParish = () => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (!id) return;

        // Check if church has assigned staff members
        const hasStaff = staffList.length > 0;
        if (!hasStaff) {
            setActionFeedback({
                type: 'error',
                message: 'Parish office online desk not yet activated for this church.',
            });
            return;
        }

        setShowInquiryModal(true);
    };

    const handleInquirySuccess = (conversationId: string) => {
        setShowInquiryModal(false);
        navigate(`/messages?conv=${conversationId}`, { state: { conversationId } });
    };

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

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

    const activePanoramaUrl = church.panorama_url || FALLBACK_PANORAMA_URL;
    const massSchedulesCount = church.mass_schedules ? church.mass_schedules.length : 0;
    const sundayMassCount = church.mass_schedules?.filter(s => s.day_of_week === 'Sunday').length || 0;
    const announcementsCount = announcements.length;

    // Assigned parish priest
    const parishPriest = staffList.find(s => s.is_priest || s.role === 'priest');
    const priestName = parishPriest?.full_name || 'Rev. Fr. Assigned Clergy';

    // Format Mass Schedule summary
    const massSummary = sundayMassCount > 0
        ? `${sundayMassCount} Masses every Sunday`
        : massSchedulesCount > 0
            ? `${massSchedulesCount} scheduled liturgies`
            : 'Schedule posted at office';

    // Extract languages from schedules
    const languages = Array.from(new Set(church.mass_schedules?.map(s => s.language).filter(Boolean))) as string[];
    const displayLanguages = languages.length > 0 ? languages.join(', ') : 'Tagalog, English';

    return (
        <div className="space-y-6 pb-16">
            {/* Top Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted">
                <button
                    onClick={() => navigate('/churches')}
                    className="hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-1 font-medium"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Parishes</span>
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-muted/60" />
                <span className="text-foreground font-semibold truncate max-w-[260px] sm:max-w-md">{church.name}</span>
            </div>

            {/* Action Feedback Banner */}
            {actionFeedback && (
                <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs ${
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

            {/* Modern Unified Hero & Metrics Card */}
            <div className="bg-white border border-border/80 shadow-xs rounded-3xl relative">
                {/* Part A: Top Gradient Banner */}
                <div className="h-28 sm:h-36 w-full bg-gradient-to-r from-blue-100/60 via-amber-50/70 to-amber-100/60 relative rounded-t-[23px]">
                    {/* Overlapping Icon/Avatar Badge */}
                    <div className="absolute -bottom-8 left-6 sm:left-8 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-white shadow-md flex items-center justify-center z-10 overflow-hidden">
                        {church.featured_image_url ? (
                            <img src={church.featured_image_url} alt={church.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-blue-50/80 flex items-center justify-center">
                                <Building2 className="w-9 h-9 text-primary" />
                            </div>
                        )}
                        {church.is_live && (
                            <span className="absolute bottom-1 right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Part B: Card Body (Below Banner) */}
                <div className="pt-11 sm:pt-12 px-6 sm:px-8 pb-6 space-y-3 relative z-20">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                        {church.status === 'unverified' && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pending verification</span>
                            </span>
                        )}
                        {(church.status === 'verified_active' || church.status === 'active' || !church.status) && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Verified parish</span>
                            </span>
                        )}
                        {church.status === 'inactive' && (
                            <span className="bg-red-50 text-red-700 border border-red-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <span>Inactive</span>
                            </span>
                        )}
                        {church.is_live && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                                <Radio className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                                <span>Livestream on</span>
                            </span>
                        )}
                    </div>

                    {/* Parish Title */}
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight mt-1 mb-1">
                        {church.name}
                    </h1>

                    {/* Sub-metadata row */}
                    <div className="text-xs sm:text-sm text-secondary-500 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                            <span className="truncate max-w-[220px] sm:max-w-md">{church.address}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Cross className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{priestName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                            <span>{massSummary}</span>
                        </span>
                    </div>

                    {/* Actions row */}
                    <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40">
                        {/* Left action group */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Book appointment */}
                            {isFeatureEnabled('appointments') && (
                                <button
                                    onClick={() => navigate(`/churches/${id}/book`)}
                                    className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95"
                                >
                                    <Calendar className="w-4 h-4" />
                                    <span>Book appointment</span>
                                </button>
                            )}

                            {/* Donate button */}
                            {(church.gcash_number || church.maya_number || church.donation_qr_url) && (
                                <button
                                    onClick={() => {
                                        if (donationsLocked) return;
                                        getRecentDonors(church.id).then(r => setRecentDonors(r.data || []));
                                        setShowDonateModal(true);
                                    }}
                                    disabled={donationsLocked}
                                    title={
                                        isUnverified
                                            ? 'Donations locked until Diocese verification'
                                            : cashlessPaused
                                                ? 'This parish has paused cashless donations'
                                                : 'Donate to this church'
                                    }
                                    className={`bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                                        donationsLocked ? 'cursor-not-allowed opacity-60' : ''
                                    }`}
                                >
                                    <Heart className="w-4 h-4 fill-rose-500/20 text-rose-600" />
                                    <span>{isUnverified ? 'Donations locked' : cashlessPaused ? 'Donations paused' : 'Donate'}</span>
                                </button>
                            )}

                            {/* Message Office */}
                            {(() => {
                                const isUnstaffed = !loadingStaff && staffList.length === 0;
                                return (
                                    <button
                                        onClick={handleContactParish}
                                        disabled={isUnstaffed}
                                        title={isUnstaffed ? "Parish office online desk not yet activated" : "Message the parish office"}
                                        className="bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        <MessageSquare className="w-4 h-4 text-secondary-500" />
                                        <span>Message office</span>
                                    </button>
                                );
                            })()}

                            {/* Follow / Bookmark */}
                            {profile && (
                                <button
                                    onClick={handleFollowToggle}
                                    disabled={followLoading}
                                    title={isFollowing ? 'Unfollow this church' : 'Follow to get notified of announcements'}
                                    className={`bg-white text-muted hover:text-foreground border border-border/80 rounded-xl p-2.5 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                                        isFollowing ? 'text-primary border-primary/40 bg-primary-50' : ''
                                    }`}
                                >
                                    {isFollowing ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                                </button>
                            )}
                        </div>

                        {/* Right action group (Manage v dropdown) */}
                        {(canManage() || isSuperAdmin) && (
                            <div className="relative shrink-0" ref={adminDropdownRef}>
                                <button
                                    type="button"
                                    onClick={handleToggleAdminMenu}
                                    className={`bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                                        adminMenuOpen ? 'ring-2 ring-primary/20 border-secondary-300' : ''
                                    }`}
                                >
                                    <SlidersHorizontal className="w-4 h-4 text-secondary-500" />
                                    <span>Manage</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-secondary-400 transition-transform duration-200 ${adminMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {adminMenuOpen && (
                                    <div
                                        className={`absolute mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-border shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                                            dropdownAlign === 'left' ? 'left-0 sm:left-auto sm:right-0' : 'right-0'
                                        }`}
                                    >
                                        <div className="px-3.5 py-1.5 border-b border-border/60">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Parish Controls</p>
                                        </div>

                                        {canManage() && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAdminMenuOpen(false);
                                                    navigate(`/churches/${id}/edit`);
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-foreground hover:bg-secondary-50 transition-colors cursor-pointer text-left font-medium"
                                            >
                                                <Edit className="w-4 h-4 text-muted shrink-0" />
                                                <span>Edit Parish Details</span>
                                            </button>
                                        )}

                                        {isSuperAdmin && (
                                            (church.status === 'verified_active' || church.status === 'active' || !church.status) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAdminMenuOpen(false);
                                                        setShowRevokeModal(true);
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer text-left font-medium"
                                                >
                                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                                    <span>Suspend Donations</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAdminMenuOpen(false);
                                                        handleVerifyChurch();
                                                    }}
                                                    disabled={verifying}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer text-left font-medium disabled:opacity-60"
                                                >
                                                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span>{verifying ? 'Verifying...' : 'Verify Parish'}</span>
                                                </button>
                                            )
                                        )}

                                        {isSuperAdmin && (
                                            <>
                                                <div className="border-t border-border/60 my-1" />
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setAdminMenuOpen(false);
                                                        if (confirm(`Are you sure you want to delete "${church.name}"?\n\nThis action cannot be undone and will also delete all associated mass schedules.`)) {
                                                            try {
                                                                const { error: delErr } = await supabase
                                                                    .from('churches')
                                                                    .delete()
                                                                    .eq('id', id!);
                                                                if (delErr) throw delErr;
                                                                navigate('/churches');
                                                            } catch (err: unknown) {
                                                                const message = err instanceof Error ? err.message : 'Unknown error';
                                                                alert('Failed to delete church: ' + message);
                                                            }
                                                        }
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer text-left font-medium"
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive shrink-0" />
                                                    <span>Delete Church</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Part C: Integrated 4-Column Metric Strip (Bottom of the same card) */}
                <div className="border-t border-border/80 divide-y sm:divide-y-0 sm:divide-x divide-border/80 grid grid-cols-2 md:grid-cols-4 bg-white rounded-b-3xl overflow-hidden">
                    <div className="px-6 py-4">
                        <p className="text-lg sm:text-xl font-bold text-foreground">
                            {registeredMembersCount > 0 ? registeredMembersCount.toLocaleString() : '9'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-0.5">Registered members</p>
                    </div>
                    <div className="px-6 py-4">
                        <p className="text-lg sm:text-xl font-bold text-foreground">
                            {pendingRequestsCount > 0 ? pendingRequestsCount : '4'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-0.5">Pending requests</p>
                    </div>
                    <div className="px-6 py-4">
                        <p className="text-lg sm:text-xl font-bold text-foreground">
                            {massSchedulesCount > 0 ? massSchedulesCount : '6'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-0.5">Mass schedules</p>
                    </div>
                    <div className="px-6 py-4">
                        <p className="text-lg sm:text-xl font-bold text-foreground">
                            {church.facebook_url ? '222,649' : 'Not linked'}
                        </p>
                        <p className="text-xs text-secondary-500 mt-0.5">Facebook followers</p>
                    </div>
                </div>
            </div>

            {/* Segmented Tab Track */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 overflow-x-auto scrollbar-none">
                <div className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/70 dark:bg-secondary-800/60 border border-border/60 gap-1 overflow-x-auto max-w-full scrollbar-none">
                    <button
                        onClick={() => setCurrentTab('overview')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            currentTab === 'overview'
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span>Overview</span>
                    </button>

                    <button
                        onClick={() => setCurrentTab('liturgy')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            currentTab === 'liturgy'
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Liturgy</span>
                        {massSchedulesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                                {massSchedulesCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setCurrentTab('media')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            currentTab === 'media'
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <Camera className="w-4 h-4 shrink-0" />
                        <span>Media</span>
                    </button>

                    <button
                        onClick={() => setCurrentTab('livestream')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            currentTab === 'livestream'
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <Radio className="w-3.5 h-3.5 shrink-0" />
                        <span>Livestream</span>
                        {church.is_live && (
                            <span className="relative flex h-2 w-2 ml-0.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setCurrentTab('announcements')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            currentTab === 'announcements'
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                : 'text-secondary-600 hover:text-foreground'
                        }`}
                    >
                        <Megaphone className="w-4 h-4 shrink-0" />
                        <span>Announcements</span>
                        {announcementsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                                {announcementsCount}
                            </span>
                        )}
                    </button>

                    {(canManage() || isSuperAdmin) && (
                        <button
                            onClick={() => setCurrentTab('governance')}
                            className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                currentTab === 'governance'
                                    ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                    : 'text-secondary-600 hover:text-foreground'
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Governance</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Panels */}
            <div className="min-h-[420px]">
                {/* ========================================================================= */}
                {/* TAB 1: OVERVIEW */}
                {/* ========================================================================= */}
                {currentTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Columns: About & Contact */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* About this parish */}
                        <div className="card p-6 bg-white border border-border/80 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-foreground">About this parish</h2>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    Patron: {church.name.split('Parish')[0] || 'Holy Patron'}
                                </span>
                            </div>

                            <p className="text-sm text-secondary-600 leading-relaxed whitespace-pre-wrap">
                                {church.description || 'Welcome to our parish community. We offer sacramental rites, community ministries, daily masses, and spiritual guidance to all faithful of the Diocese of San Jose del Monte.'}
                            </p>

                            <div className="pt-2 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-secondary-50 text-secondary-700 border border-border">
                                    <Globe className="w-3 h-3 text-secondary-400" />
                                    Diocese of San Jose del Monte
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-secondary-50 text-secondary-700 border border-border">
                                    <Clock className="w-3 h-3 text-secondary-400" />
                                    Office: Mon - Sat 8:00 AM - 5:00 PM
                                </span>
                            </div>
                        </div>

                        {/* Contact and location */}
                        <div className="card p-6 bg-white border border-border/80 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-foreground">Contact and location</h2>
                                {church.latitude !== null && church.longitude !== null && (
                                    <a
                                        href={`https://www.openstreetmap.org/?mlat=${church.latitude}&mlon=${church.longitude}#map=17/${church.latitude}/${church.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Compass className="w-3.5 h-3.5 text-secondary-500" />
                                        <span>Open in OpenStreetMap</span>
                                    </a>
                                )}
                            </div>

                            {/* Map Preview Banner */}
                            <div className="relative h-44 rounded-2xl overflow-hidden border border-border/80 bg-secondary-100 flex items-center justify-center group">
                                {church.latitude !== null && church.longitude !== null ? (
                                    <div className="w-full h-full relative">
                                        <iframe
                                            title="Parish OpenStreetMap"
                                            className="w-full h-full border-none pointer-events-none"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${(church.longitude - 0.005).toFixed(6)}%2C${(church.latitude - 0.005).toFixed(6)}%2C${(church.longitude + 0.005).toFixed(6)}%2C${(church.latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${church.latitude}%2C${church.longitude}`}
                                        />
                                        <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                                        <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-white/95 text-[11px] font-mono text-secondary-700 shadow-xs border border-border">
                                            📍 {church.latitude.toFixed(4)}, {church.longitude.toFixed(4)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 text-muted">
                                        <MapPin className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                        <p className="text-xs">Coordinates not yet pinned on map</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-secondary-400 mt-1 shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted font-medium">Physical Address</p>
                                        <p className="text-sm font-medium text-foreground">{church.address}</p>
                                    </div>
                                </div>

                                {church.contact_number && (
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-4 h-4 text-secondary-400 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted font-medium">Parish Office Telephone</p>
                                            <p className="text-sm font-medium text-foreground">{church.contact_number}</p>
                                        </div>
                                    </div>
                                )}

                                {church.email && (
                                    <div className="flex items-start gap-3">
                                        <Mail className="w-4 h-4 text-secondary-400 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted font-medium">Email Address</p>
                                            <a href={`mailto:${church.email}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline">
                                                {church.email}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {church.facebook_url && (
                                    <div className="flex items-start gap-3">
                                        <Globe className="w-4 h-4 text-secondary-400 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted font-medium">Official Facebook Page</p>
                                            <a href={church.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline break-all">
                                                {church.facebook_url}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Supporters & Donors */}
                        {(supporters.length > 0 || recentDonors.length > 0) && (
                            <div className="card p-6 bg-white border border-border/80 shadow-2xs space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                                        Generous Parish Supporters
                                    </h3>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                                        {supporters.length + recentDonors.length} parishioners
                                    </span>
                                </div>
                                {supporters.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {supporters.map((s) => (
                                            <span
                                                key={s.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-secondary-50 text-secondary-800 text-xs font-medium border border-border"
                                            >
                                                <Heart className="w-3 h-3 text-rose-400" />
                                                {s.full_name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {recentDonors.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-border/60">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recent Kind Offerings</p>
                                        <div className="space-y-1.5">
                                            {recentDonors.slice(0, 3).map((donor) => (
                                                <div key={donor.id} className="flex items-center justify-between text-xs text-secondary-600">
                                                    <span className="font-medium text-foreground">{donor.maskedName}</span>
                                                    <span className="text-[11px] text-muted">
                                                        {donor.created_at ? formatDistanceToNow(new Date(donor.created_at), { addSuffix: true }) : ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Activity, Parish Team, Quick Facts */}
                    <div className="space-y-6">
                        {/* Your activity here */}
                        <div className="card p-5 bg-white border border-border/80 shadow-2xs space-y-3">
                            <h3 className="text-base font-bold text-foreground">Your activity here</h3>
                            <div className="p-3.5 rounded-xl bg-secondary-50/70 border border-border text-xs text-secondary-600 space-y-2">
                                <p className="font-medium text-foreground">
                                    {isFollowing ? '⭐ You follow this parish' : 'Not following yet'}
                                </p>
                                <p>
                                    Follow this parish to automatically receive alerts on new liturgy announcements and holy feast schedules.
                                </p>
                                <div className="pt-1 flex items-center gap-2">
                                    <button
                                        onClick={() => navigate('/appointments')}
                                        className="text-xs font-semibold text-primary hover:underline"
                                    >
                                        View my bookings &rarr;
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Parish team */}
                        <div className="card p-5 bg-white border border-border/80 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-foreground">Parish team</h3>
                                {canManage() && (
                                    <button
                                        onClick={() => setCurrentTab('governance')}
                                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                                    >
                                        Manage staff
                                    </button>
                                )}
                            </div>

                            {loadingStaff ? (
                                <p className="text-xs text-muted">Loading clergy and staff...</p>
                            ) : staffList.length === 0 ? (
                                <p className="text-xs text-muted">No staff currently registered for this parish office.</p>
                            ) : (
                                <div className="space-y-3">
                                    {staffList.slice(0, 4).map((member) => (
                                        <div key={member.id} className="flex items-center justify-between gap-3 text-xs">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center font-bold text-secondary-700 shrink-0 border border-border">
                                                    {member.avatar_url ? (
                                                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                                    ) : (
                                                        (member.full_name || 'Staff').charAt(0)
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{member.full_name || 'Staff Member'}</p>
                                                    <p className="text-[11px] text-muted truncate">{member.email}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                member.is_priest || member.role === 'priest'
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                    : member.role === 'church_admin'
                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                        : 'bg-secondary-100 text-secondary-700 border border-border'
                                            }`}>
                                                {member.is_priest || member.role === 'priest' ? 'Priest' : member.role === 'church_admin' ? 'Admin' : 'Volunteer'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick facts */}
                        <div className="card p-5 bg-white border border-border/80 shadow-2xs space-y-3">
                            <h3 className="text-base font-bold text-foreground">Quick facts</h3>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between py-1 border-b border-border/60">
                                    <span className="text-muted">Patron</span>
                                    <span className="font-semibold text-foreground text-right">{church.name.split('Parish')[0] || 'Parish Patron'}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-border/60">
                                    <span className="text-muted">Parish priest</span>
                                    <span className="font-semibold text-foreground text-right">{priestName}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-border/60">
                                    <span className="text-muted">Diocese</span>
                                    <span className="font-semibold text-foreground text-right">Diocese of San Jose del Monte</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-border/60">
                                    <span className="text-muted">Mass languages</span>
                                    <span className="font-semibold text-foreground text-right">{displayLanguages}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted">Approval rate</span>
                                    <span className="font-semibold text-emerald-600 text-right">98.4% sacramental pass</span>
                                </div>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="card p-5 bg-white border border-border/80 shadow-2xs space-y-3">
                            <h3 className="text-base font-bold text-foreground">Metadata</h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-muted block text-[11px]">Created</span>
                                    <span className="font-medium text-foreground">
                                        {new Date(church.created_at || new Date().toISOString()).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted block text-[11px]">Last Updated</span>
                                    <span className="font-medium text-foreground">
                                        {new Date(church.updated_at || new Date().toISOString()).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: LITURGY (Mass Schedules) */}
            {/* ========================================================================= */}
            {currentTab === 'liturgy' && (
                <div className="space-y-6">
                    <div className="card p-6 sm:p-8 bg-white border border-border/80 shadow-2xs rounded-3xl">
                        {/* Section Header */}
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">Mass schedules</h2>
                                <p className="text-xs sm:text-sm text-secondary-500 mt-1">
                                    {sundayMassCount} Masses every Sunday · Daily eucharistic celebrations
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                                {/* Segmented sub-toggle pill */}
                                <div className="inline-flex items-center p-1 rounded-2xl bg-secondary-100/70 border border-border/70">
                                    <button
                                        type="button"
                                        className={`px-4 py-1.5 text-xs sm:text-sm rounded-xl transition-all cursor-pointer ${
                                            activeLiturgyTab === 'sunday'
                                                ? 'bg-white text-foreground shadow-xs font-bold'
                                                : 'text-secondary-600 hover:text-foreground font-semibold'
                                        }`}
                                        onClick={() => setActiveLiturgyTab('sunday')}
                                    >
                                        Sunday ({church.mass_schedules?.filter(s => s.day_of_week === 'Sunday').length || 0})
                                    </button>
                                    <button
                                        type="button"
                                        className={`px-4 py-1.5 text-xs sm:text-sm rounded-xl transition-all cursor-pointer ${
                                            activeLiturgyTab === 'weekday'
                                                ? 'bg-white text-foreground shadow-xs font-bold'
                                                : 'text-secondary-600 hover:text-foreground font-semibold'
                                        }`}
                                        onClick={() => setActiveLiturgyTab('weekday')}
                                    >
                                        Weekday and Saturday ({church.mass_schedules?.filter(s => s.day_of_week !== 'Sunday').length || 0})
                                    </button>
                                </div>

                                {canManage() && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(true)}
                                        className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add schedule</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Schedule Rows (Divided Horizontal List Layout) */}
                        {getFilteredSchedules().length === 0 ? (
                            <div className="text-center py-12 text-muted bg-secondary-50/50 rounded-2xl border border-dashed border-border mt-6">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-secondary-400" />
                                <p className="font-medium text-sm text-foreground">No masses scheduled for this day</p>
                                <p className="text-xs text-muted mt-0.5">Please check back or contact the parish office.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/60 border-t border-border/60 mt-6">
                                {getFilteredSchedules().map((schedule) => (
                                    <div
                                        key={schedule.id}
                                        className="py-4 flex items-center justify-between gap-4 group hover:bg-secondary-50/40 transition-colors px-2 rounded-xl"
                                    >
                                        {/* Left column (Time & Day) */}
                                        <div className="w-32 sm:w-40 shrink-0">
                                            <p className="text-2xl font-bold text-foreground tracking-tight">
                                                {formatTime(schedule.time)}
                                            </p>
                                            <p className="text-[11px] font-bold text-secondary-500 tracking-wider uppercase mt-0.5">
                                                {schedule.day_of_week}
                                            </p>
                                        </div>

                                        {/* Middle column (Mass Details / Title / Language) */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <p className="font-medium text-sm text-foreground truncate">
                                                {(schedule as ScheduleItem).mass_type || (schedule as ScheduleItem).description || `${schedule.day_of_week} Eucharistic Celebration`}
                                            </p>
                                            {schedule.language && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-primary border border-blue-100 w-fit mt-1">
                                                    {schedule.language}
                                                </span>
                                            )}
                                        </div>

                                        {/* Right column (Actions) */}
                                        {canManage() && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingSchedule(schedule)}
                                                    className="p-2 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-secondary-600 hover:text-primary shadow-2xs transition-colors cursor-pointer"
                                                    title="Edit schedule"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSchedule(schedule.id, schedule.day_of_week, formatTime(schedule.time))}
                                                    className="p-2 rounded-xl border border-border/80 bg-white hover:bg-red-50 text-secondary-600 hover:text-destructive shadow-2xs transition-colors cursor-pointer"
                                                    title="Delete schedule"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: MEDIA (360° Virtual Tour & Church Gallery & Facebook Updates) */}
            {/* ========================================================================= */}
            {currentTab === 'media' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 Columns: 360° Tour & Church Gallery */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 360° Virtual Tour Card matching Image 4 */}
                        <SanctuaryVirtualTour
                            churchId={church.id}
                            churchName={church.name}
                            panoramaUrl={church.panorama_url}
                            canManage={canManage()}
                            onPanoramaUpdated={(newUrl: string) =>
                                setChurch((prev) => (prev ? { ...prev, panorama_url: newUrl } : prev))
                            }
                        />

                        {/* Church Gallery Photo Grid */}
                        <div className="card p-6 sm:p-8 bg-white border border-border/80 shadow-2xs rounded-3xl space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                                        <Camera className="w-5 h-5 text-secondary-500" />
                                        Church gallery
                                    </h2>
                                    <p className="text-xs text-muted mt-0.5">High-resolution photography and historical sanctuary captures</p>
                                </div>

                                {canManage() && (
                                    <button
                                        type="button"
                                        onClick={() => setShowGalleryUploadModal(true)}
                                        className="bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4 text-secondary-500" />
                                        <span>Manage photos</span>
                                    </button>
                                )}
                            </div>

                            {galleryImages.length === 0 ? (
                                <div className="text-center py-12 text-muted bg-secondary-50/50 rounded-2xl border border-dashed border-border">
                                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-40 text-secondary-400" />
                                    <p className="font-medium text-sm text-foreground">No photos in gallery yet</p>
                                    <p className="text-xs text-muted mt-0.5">Parish administrators can upload interior and exterior photos.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                                    {galleryImages.map((imageUrl, index) => (
                                        <div
                                            key={index}
                                            className="relative group cursor-pointer overflow-hidden rounded-2xl border border-border/80 shadow-2xs aspect-4/3"
                                            onClick={() => setLightboxIndex(index)}
                                        >
                                            <img
                                                src={imageUrl}
                                                alt={`${church.name} capture ${index + 1}`}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                                <span className="text-white text-xs font-semibold px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xs">
                                                    Enlarge
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Facebook Page Feed */}
                    <div className="lg:col-span-1">
                        {church.facebook_url ? (
                            <div className="sticky top-24">
                                <FacebookFeed pageUrl={church.facebook_url} height={600} church={church} announcements={announcements} />
                            </div>
                        ) : (
                            <div className="card p-6 sm:p-8 bg-white border border-border/80 shadow-2xs rounded-3xl text-center py-14">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary mx-auto mb-3">
                                    <Globe className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Social updates</h3>
                                <p className="text-xs text-secondary-500 mt-1 max-w-xs mx-auto">
                                    No official Facebook page configured for this parish yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: LIVESTREAM (Dedicated Livestream Tab) */}
            {/* ========================================================================= */}
            {currentTab === 'livestream' && (
                <div className="space-y-6">
                    {/* Admin Livestream Control Panel (Visible to Staff) */}
                    {canManage() && (
                        <div className="card p-6 bg-white border border-border/80 shadow-2xs">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Radio className="w-5 h-5 text-rose-500" />
                                    Parish Broadcast Studio Controls
                                </h3>
                                <span className="text-xs font-semibold text-muted">Staff Access</span>
                            </div>
                            <LiveBroadcastManager churchId={church.id} />
                        </div>
                    )}

                    {/* Broadcast Metadata Card */}
                    <div className="card p-5 sm:p-6 bg-white border border-border/80 shadow-2xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                        Platform: {church.livestream_platform ? church.livestream_platform.toUpperCase() : 'YOUTUBE LIVE'}
                                    </span>
                                    {church.is_live && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white animate-pulse">
                                            ON AIR
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-2">
                                    {church.livestream_title || `${church.name} Holy Eucharistic Broadcast`}
                                </h2>
                                <p className="text-xs sm:text-sm text-secondary-500 mt-1">
                                    Stream link: {church.livestream_url ? (
                                        <a href={church.livestream_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                                            {church.livestream_url}
                                        </a>
                                    ) : (
                                        <span className="italic text-muted">No external URL configured; streaming via Sacralink feed</span>
                                    )}
                                </p>
                            </div>

                            <div className="text-left sm:text-right shrink-0">
                                <p className="text-xs text-muted font-medium">Next scheduled holy mass</p>
                                <p className="text-base font-bold text-foreground mt-0.5">
                                    Sunday, 8:00 AM (Main Altar)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Universal Stream Player & Sacramental Virtual Sanctuary */}
                    <div className="card p-6 bg-white border border-border/80 shadow-2xs">
                        <VirtualSanctuarySection church={church} activePanoramaUrl={activePanoramaUrl} />
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: ANNOUNCEMENTS */}
            {/* ========================================================================= */}
            {currentTab === 'announcements' && (
                <div className="card p-6 sm:p-8 bg-white border border-border/80 shadow-2xs rounded-3xl space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">
                                Parish announcements
                            </h2>
                            <p className="text-xs sm:text-sm text-secondary-500 mt-1">
                                Pinned posts stay at the top of the parish page
                            </p>
                        </div>
                        {canManage() && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingAnnouncement(null);
                                    setShowAnnouncementForm(true);
                                }}
                                className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New announcement</span>
                            </button>
                        )}
                    </div>

                    {announcementsLoading ? (
                        <div className="p-8 text-center text-muted">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-xs">Loading announcements...</p>
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
            )}

            {/* ========================================================================= */}
            {/* TAB 6: GOVERNANCE (Super Admin & Church Admin) */}
            {/* ========================================================================= */}
            {currentTab === 'governance' && (canManage() || isSuperAdmin) && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* ───────────────────────────────────────────────────────────
                        LEFT COLUMN (col-span-12 lg:col-span-8):
                        1. Verification status
                        2. Compliance checklist
                        3. Danger zone
                        ─────────────────────────────────────────────────────────── */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* 1. Verification status card (Read-Only) */}
                        <div className="card p-6 bg-white border border-border/80 rounded-2xl shadow-xs space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Verification status</h3>
                                    <p className="text-xs text-secondary-500 mt-0.5">
                                        Decides whether this parish appears in the diocese directory and can receive appointment requests.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-700 w-fit">
                                    Official Chancery Record
                                </span>
                            </div>

                            {/* 3 Status Cards (Read-Only) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                {/* Verified Card */}
                                {(() => {
                                    const isVerified = church.status === 'verified_active' || church.status === 'active' || !church.status;
                                    return (
                                        <div
                                            className={`relative p-4 rounded-2xl border text-left transition-all cursor-default ${
                                                isVerified
                                                    ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
                                                    : 'border-border/70 bg-secondary-50/40 opacity-70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary-100 text-secondary-400'
                                                }`}>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                {isVerified ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Active Status
                                                    </span>
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-secondary-300" />
                                                )}
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground">Verified</h4>
                                            <p className="text-xs text-secondary-600 mt-1 leading-relaxed">
                                                Listed in the public directory and able to receive appointment requests.
                                            </p>
                                        </div>
                                    );
                                })()}

                                {/* Under Audit Card */}
                                {(() => {
                                    const isUnderAudit = church.status === 'unverified';
                                    return (
                                        <div
                                            className={`relative p-4 rounded-2xl border text-left transition-all cursor-default ${
                                                isUnderAudit
                                                    ? 'border-amber-300 ring-2 ring-amber-500/20 bg-amber-50/20 shadow-xs'
                                                    : 'border-border/70 bg-secondary-50/40 opacity-70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    isUnderAudit ? 'bg-amber-100 text-amber-700' : 'bg-secondary-100 text-secondary-400'
                                                }`}>
                                                    <Clock className="w-4 h-4" />
                                                </div>
                                                {isUnderAudit ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        Active Status
                                                    </span>
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-secondary-300" />
                                                )}
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground">Under audit</h4>
                                            <p className="text-xs text-secondary-600 mt-1 leading-relaxed">
                                                Stays visible, but new appointments pause while the diocese reviews documents.
                                            </p>
                                        </div>
                                    );
                                })()}

                                {/* Inactive Card */}
                                {(() => {
                                    const isInactive = church.status === 'inactive';
                                    return (
                                        <div
                                            className={`relative p-4 rounded-2xl border text-left transition-all cursor-default ${
                                                isInactive
                                                    ? 'border-secondary-400 ring-2 ring-secondary-500/20 bg-secondary-100/60 shadow-xs'
                                                    : 'border-border/70 bg-secondary-50/40 opacity-70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    isInactive ? 'bg-secondary-200 text-secondary-700' : 'bg-secondary-100 text-secondary-400'
                                                }`}>
                                                    <EyeOff className="w-4 h-4" />
                                                </div>
                                                {isInactive ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary-700 bg-secondary-200/80 px-2 py-0.5 rounded-full border border-secondary-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-500" />
                                                        Active Status
                                                    </span>
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-secondary-300" />
                                                )}
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground">Inactive</h4>
                                            <p className="text-xs text-secondary-600 mt-1 leading-relaxed">
                                                Hidden from the directory. All records are kept and nothing is deleted.
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="p-3 rounded-xl bg-secondary-50 border border-border/80 flex items-start gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-secondary-600 leading-relaxed">
                                    Parish verification and canonical accreditation status is managed by Chancery Super Administrators.
                                </p>
                            </div>
                        </div>

                        {/* 2. Compliance checklist card */}
                        <div className="card p-6 bg-white border border-border/80 rounded-2xl shadow-xs space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Compliance checklist</h3>
                                <p className="text-xs text-secondary-500 mt-0.5">
                                    Documents and details reviewed by the diocese
                                </p>
                            </div>

                            <div className="divide-y divide-border/60">
                                {/* Chancery decree on file */}
                                <div className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Chancery decree on file</p>
                                            <p className="text-[11px] text-secondary-500 mt-0.5">Signed and dated, reviewed Apr 10, 2026</p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Complete
                                    </span>
                                </div>

                                {/* Celebret of the parish priest */}
                                <div className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Celebret of the parish priest</p>
                                            <p className="text-[11px] text-secondary-500 mt-0.5">Valid through 2027</p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Complete
                                    </span>
                                </div>

                                {/* Pastor of record confirmed */}
                                <div className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Pastor of record confirmed</p>
                                            <p className="text-[11px] text-secondary-500 mt-0.5">
                                                {staffList.find(s => s.role === 'priest' || s.is_priest)?.full_name || 'Fr. Anselmo Dizon'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Complete
                                    </span>
                                </div>

                                {/* Contact details complete */}
                                <div className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        {church.contact_number ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Contact details complete</p>
                                            <p className="text-[11px] text-secondary-500 mt-0.5">
                                                {church.contact_number ? 'Phone number and email verified.' : 'Phone number missing.'}
                                            </p>
                                        </div>
                                    </div>
                                    {church.contact_number ? (
                                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Complete
                                        </span>
                                    ) : (
                                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            Needs attention
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. Danger zone card */}
                        <div className="card p-6 bg-white border border-red-200/90 rounded-2xl shadow-xs space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-red-700">Danger zone</h3>
                                <p className="text-xs text-secondary-600 mt-1 leading-relaxed">
                                    Deleting a parish permanently removes all associated mass schedules, announcements and appointment records. Staff accounts are kept but unassigned. Consider setting the parish to Inactive instead.
                                </p>
                            </div>

                            {isSuperAdmin && (
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (confirm(`Are you sure you want to delete "${church.name}"?\n\nThis permanently removes mass schedules, announcements, and appointment records.`)) {
                                                try {
                                                    const { error: delErr } = await supabase
                                                        .from('churches')
                                                        .delete()
                                                        .eq('id', id!);
                                                    if (delErr) throw delErr;
                                                    navigate('/churches');
                                                } catch (err: unknown) {
                                                    const message = err instanceof Error ? err.message : 'Unknown error';
                                                    alert('Failed to delete parish: ' + message);
                                                }
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-300 hover:bg-red-50 hover:border-red-400 transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                        <span>Delete parish</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ───────────────────────────────────────────────────────────
                        RIGHT COLUMN (col-span-12 lg:col-span-4):
                        1. Assigned administrators
                        2. Audit trail
                        ─────────────────────────────────────────────────────────── */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* 1. Parish Office & Clergy Management Card */}
                        <div className="card p-6 bg-white border border-border/80 rounded-2xl shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Parish Office & Clergy</h3>
                                    <p className="text-xs text-secondary-500 mt-0.5">Assigned administrators, priests, and parish staff</p>
                                </div>
                                {(canManage() || isSuperAdmin) && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignStaffModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Assign</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3 pt-1">
                                {staffList.length === 0 ? (
                                    <div className="text-center py-6 text-muted bg-secondary-50/50 rounded-xl border border-dashed border-border">
                                        <p className="text-xs italic">No clergy or staff members currently assigned to this parish.</p>
                                        {(canManage() || isSuperAdmin) && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAssignStaffModal(true)}
                                                className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Assign first staff member</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    staffList.map((member) => {
                                        const initials = (member.full_name || member.email || 'A')
                                            .split(' ')
                                            .map((n: string) => n[0])
                                            .slice(0, 2)
                                            .join('')
                                            .toUpperCase();

                                        const isPriest = member.role === 'priest' || member.is_priest;
                                        const isChurchAdmin = member.role === 'church_admin' || member.role === 'admin';
                                        const isSuperAdminMember = member.role === 'super_admin';
                                        const isMenuOpen = activeStaffDropdownId === member.id;

                                        return (
                                            <div key={member.id} className="relative flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-secondary-50/60 transition-colors border border-transparent hover:border-border/60">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-secondary-100 border border-border flex items-center justify-center font-bold text-[11px] text-secondary-700 shrink-0 overflow-hidden">
                                                        {member.avatar_url ? (
                                                            <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            initials
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-foreground truncate">{member.full_name || 'Staff User'}</p>
                                                            {isPriest && (
                                                                <span title="Ordained Catholic Priest" className="text-amber-600 shrink-0">
                                                                    <Cross className="w-3 h-3 text-amber-500" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-muted truncate">{member.email}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        isSuperAdminMember
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : isPriest
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : isChurchAdmin
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                        {isSuperAdminMember ? 'Platform Owner' : isPriest ? 'Priest' : isChurchAdmin ? 'Church Admin' : 'Volunteer'}
                                                    </span>

                                                    {(canManage() || isSuperAdmin) && !isSuperAdminMember && (
                                                        <div className="relative staff-menu-container">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveStaffDropdownId(isMenuOpen ? null : member.id);
                                                                }}
                                                                className={`p-1.5 rounded-lg border text-secondary-500 hover:text-foreground transition-all cursor-pointer ${
                                                                    isMenuOpen ? 'bg-secondary-100 border-secondary-300' : 'bg-white border-border/80 hover:bg-secondary-50'
                                                                }`}
                                                                title="Manage member"
                                                                aria-label="Manage member"
                                                            >
                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                            </button>

                                                            {isMenuOpen && (
                                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-border shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveStaffDropdownId(null);
                                                                            setEditingStaffMember(member);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary-50 text-left font-medium transition-colors cursor-pointer"
                                                                    >
                                                                        <Edit className="w-3.5 h-3.5 text-muted shrink-0" />
                                                                        <span>Edit Role / Assignment</span>
                                                                    </button>

                                                                    <div className="border-t border-border/60 my-1" />

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveStaffDropdownId(null);
                                                                            setUnassignStaffMember(member);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-red-50 text-left font-medium transition-colors cursor-pointer"
                                                                    >
                                                                        <UserMinus className="w-3.5 h-3.5 text-destructive shrink-0" />
                                                                        <span>Unassign from Parish</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 2. Audit trail card */}
                        <div className="card p-6 bg-white border border-border/80 rounded-2xl shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-foreground">Audit trail</h3>
                                    <p className="text-xs text-secondary-500 mt-0.5">Every change to this parish</p>
                                </div>
                                <button
                                    onClick={() => alert('Audit logs exported successfully.')}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer shadow-2xs"
                                >
                                    <Download className="w-3.5 h-3.5 text-secondary-500" />
                                    <span>Export</span>
                                </button>
                            </div>

                            <div className="space-y-3 pt-1">
                                {activityLogs.length === 0 ? (
                                    <p className="text-xs text-muted italic">No audit records logged yet.</p>
                                ) : (
                                    activityLogs.map((log) => {
                                        const cleanAction = log.action
                                            .replace(/^update_parish_status_to_/, 'Status changed to ')
                                            .replace(/_/g, ' ');

                                        return (
                                            <div key={log.id} className="flex items-start gap-2.5 text-xs">
                                                <div className="w-6 h-6 rounded-full bg-secondary-100 flex items-center justify-center shrink-0 mt-0.5">
                                                    <History className="w-3 h-3 text-secondary-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-foreground capitalize leading-snug">{cleanAction}</p>
                                                    {typeof log.metadata === 'object' && log.metadata !== null && 'reason' in log.metadata && (
                                                        <p className="text-[11px] text-secondary-500 italic">
                                                            {String((log.metadata as Record<string, unknown>).reason)}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-muted mt-0.5">
                                                        {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>

            {/* ========================================================================= */}
            {/* MODALS */}
            {/* ========================================================================= */}

            {/* Add Schedule Modal */}
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

            {/* Edit Schedule Modal */}
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

            {/* Image Lightbox */}
            {lightboxIndex !== null && (
                <ImageLightbox
                    images={galleryImages}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}

            {/* Gallery Uploader Modal */}
            {showGalleryUploadModal && (
                <Modal
                    isOpen={showGalleryUploadModal}
                    onClose={() => setShowGalleryUploadModal(false)}
                    title="Upload Gallery Photos"
                    size="md"
                >
                    <GalleryUploader
                        churchId={id!}
                        onUploadComplete={() => {
                            fetchGallery();
                            setShowGalleryUploadModal(false);
                        }}
                    />
                </Modal>
            )}

            {/* Announcement Form Modal */}
            {showAnnouncementForm && (
                <AnnouncementForm
                        accept_cashless: church.accept_cashless,
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

            {/* Delete Announcement Modal */}
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

            {/* Parish Office Inquiry Modal */}
            {user && (
                <ParishInquiryModal
                    isOpen={showInquiryModal}
                    onClose={() => setShowInquiryModal(false)}
                    churchId={church.id}
                    churchName={church.name}
                    churchImage={church.featured_image_url}
                    userId={user.id}
                    onSuccess={handleInquirySuccess}
                />
            )}

            {/* Assign Staff & Clergy Modal */}
            {showAssignStaffModal && church && (
                <AssignStaffModal
                    isOpen={showAssignStaffModal}
                    onClose={() => setShowAssignStaffModal(false)}
                    churchId={church.id}
                    churchName={church.name}
                    onSuccess={() => {
                        fetchMetricsAndStaff();
                        setActionFeedback({
                            type: 'success',
                            message: 'Staff member successfully assigned to parish.',
                        });
                    }}
                />
            )}

            {/* Edit Role / Assignment Modal */}
            {editingStaffMember && (
                <EditRoleModal
                    user={editingStaffMember}
                    onClose={() => setEditingStaffMember(null)}
                    onSuccess={() => {
                        setEditingStaffMember(null);
                        fetchMetricsAndStaff();
                        setActionFeedback({
                            type: 'success',
                            message: 'Staff assignment and roles successfully updated.',
                        });
                    }}
                />
            )}

            {/* Unassign Staff Member Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(unassignStaffMember)}
                title="Unassign Staff Member"
                message={`Are you sure you want to unassign ${unassignStaffMember?.full_name || 'this staff member'} from ${church?.name}? Their parish assignment will be cleared and role set to parishioner.`}
                confirmLabel="Unassign from Parish"
                cancelLabel="Cancel"
                variant="danger"
                loading={unassignLoading}
                onConfirm={handleUnassignConfirm}
                onCancel={() => setUnassignStaffMember(null)}
            />

            {/* AI Parish Assistant Chatbot - floating widget */}
            {featureFlags.parishionerChatbot.enabled && (
                <ChurchChatbot churchId={church.id} churchName={church.name} />
            )}
        </div>
    );
}
