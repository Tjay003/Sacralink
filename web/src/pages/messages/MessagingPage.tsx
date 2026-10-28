import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
    MessageSquare,
    Search,
    Plus,
    Send,
    Video,
    ArrowLeft,
    Building2,
    Church,
    CheckCheck,
    Sparkles,
    ChevronRight,
    ChevronDown,
    Trash2,
    UserX,
    AlertTriangle,
    Mail,
    Calendar,
    Lock,
    RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    fetchUserConversations,
    fetchMessages,
    sendMessage,
    getOrCreateDirectConversation,
    getOrCreateChurchStaffChannel,
    markConversationAsRead,
    fetchAvailableContacts,
    generateMeetingRoomName,
    subscribeToMessages,
    subscribeToUserConversations,
    deleteConversationForMe,
    deleteConversationForEveryone,
    updateTicketStatus,
    reopenTicket,
    listEscalatedTicketStubs,
    requestTicketReview,
    type EscalatedTicketStub,
    isLocalConversation,
    getLocalConversationById,
    getLocalMinistryMessages,
    PARISH_MINISTRIES,
    type ConversationWithDetails,
    type MessageWithSender,
    type ContactProfile,
} from '../../lib/supabase/messaging';
import VideoConferenceModal from '../../components/conference/VideoConferenceModal';
import Modal from '../../components/ui/Modal';
import { StatusBadge, STATUS_DEFINITIONS } from '../../components/ui/StatusBadge';
import ParishInquiryModal from '../../components/churches/ParishInquiryModal';
import { useToast } from '../../contexts/toastContext';
import { directFetchChurches } from '../../lib/directApi';
import type { Profile, Church as ChurchType } from '../../types/database';
import { isTicket, isTicketRequester, canHandleTicket, MAX_REQUESTER_REOPENS, ticketLaneLabel, shouldOfferReviewRequest } from '../../lib/tickets';
import { UserName } from '../../components/ui/UserName';
import TicketAssignment from '../../components/messages/TicketAssignment';
import TicketEscalationActions from '../../components/messages/TicketEscalationActions';
import ReviewSummaryPanel from '../../components/messages/ReviewSummaryPanel';

// Video calls are hidden for now (client request); flip to true to bring the buttons and call cards back.
const VIDEO_CALLS_ENABLED = false;

const AVATAR_COLOR_MAP: Record<string, string> = {
    AD: 'bg-blue-100 text-blue-700',
    OL: 'bg-secondary-100 text-secondary-700',
    RM: 'bg-blue-50 text-blue-600',
    JM: 'bg-amber-100 text-amber-700',
    SJ: 'bg-emerald-100 text-emerald-700',
};

const getAvatarColor = (initials: string, seed: string) => {
    if (AVATAR_COLOR_MAP[initials]) return AVATAR_COLOR_MAP[initials];
    const palette = [
        'bg-blue-100 text-blue-700',
        'bg-secondary-100 text-secondary-700',
        'bg-blue-50 text-blue-600',
        'bg-amber-100 text-amber-700',
        'bg-emerald-100 text-emerald-700',
        'bg-purple-100 text-purple-700',
        'bg-rose-100 text-rose-700',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
};

const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
        return email.slice(0, 2).toUpperCase();
    }
    return 'AD';
};

// Format role badge styling helper
const getRoleBadge = (role?: string | null) => {
    switch (role) {
        case 'super_admin':
            return {
                label: 'Super Admin',
                className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300',
            };
        case 'church_admin':
            return {
                label: 'Church Admin',
                className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300',
            };
        case 'priest':
            return {
                label: 'Priest',
                className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
            };
        case 'volunteer':
            return {
                label: 'Volunteer',
                className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
            };
        case 'user':
        default:
            return {
                label: 'Parishioner',
                className: 'bg-secondary-100 text-secondary-700 border-secondary-200 dark:bg-secondary-800 dark:text-secondary-300',
            };
    }
};

// Format timestamps cleanly
const formatMessageTime = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatConversationDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Category styling helper
const getCategoryBadge = (category?: string | null) => {
    switch (category) {
        case 'baptism':
            return { label: 'Baptism', emoji: '🕊️', className: 'bg-blue-50 text-blue-700 border-blue-200' };
        case 'wedding':
            return { label: 'Wedding', emoji: '💍', className: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'funeral':
            return { label: 'Funeral', emoji: '🕯️', className: 'bg-purple-50 text-purple-700 border-purple-200' };
        case 'mass_intention':
            return { label: 'Mass Intention', emoji: '🙏', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'certificate':
            return { label: 'Certificate', emoji: '📜', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'church_setup':
            return { label: 'Church setup', emoji: '⛪', className: 'bg-blue-50 text-blue-700 border-blue-200' };
        case 'report_problem':
            return { label: 'Problem', emoji: '🛠️', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'report_person':
            return { label: 'Report a person', emoji: '⚠️', className: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'report_church':
            return { label: 'Church concern', emoji: '🚩', className: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'user_deletion_request':
            return { label: 'Deletion request', emoji: '🗑️', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'general':
        default:
            return { label: 'General Inquiry', emoji: '💬', className: 'bg-secondary-50 text-secondary-700 border-secondary-200' };
    }
};

export default function MessagingPage() {
    const { user, profile } = useAuth();
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    // Permissions: regular parishioners cannot access staff channels
    const isStaff = ['super_admin', 'church_admin', 'priest', 'volunteer'].includes(profile?.role || '');
    const isSuperAdmin = profile?.role === 'super_admin';
    const isVolunteer = profile?.role === 'volunteer';
    // Parishioners and volunteers open Parish Office Tickets; Church Admins and Priests write to the Super Admin
    const canCreateTicket = ['user', 'volunteer', 'church_admin', 'priest'].includes(profile?.role || '');
    const ticketLane = profile?.role === 'church_admin' || profile?.role === 'priest' ? 'platform' : 'church';

    interface NavState {
        conversationId?: string;
        info?: string;
    }
    const navState = location.state as NavState | null;
    // URL search param & navigation state for direct conversation links (e.g. from ChurchDetailPage)
    const convParam = searchParams.get('conv') || navState?.conversationId || new URLSearchParams(window.location.search).get('conv');
    const infoMessage = navState?.info;

    // Data states
    const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(convParam || null);
    const [messages, setMessages] = useState<MessageWithSender[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [updatingTicketStatus, setUpdatingTicketStatus] = useState(false);
    const [reopeningTicket, setReopeningTicket] = useState(false);
    const [ticketActionError, setTicketActionError] = useState<string | null>(null);
    const [requestingReview, setRequestingReview] = useState(false);
    const [ticketStubs, setTicketStubs] = useState<EscalatedTicketStub[]>([]);
    const [linkedTicketNumber, setLinkedTicketNumber] = useState<string | null>(null);
    const [followUpSource, setFollowUpSource] = useState<ConversationWithDetails | null>(null);
    // The right-hand info panel only exists from the 2xl breakpoint up; below it the review panel moves into the thread
    const [wideInfoPanel, setWideInfoPanel] = useState(() => window.matchMedia('(min-width: 1536px)').matches);
    useEffect(() => {
        const query = window.matchMedia('(min-width: 1536px)');
        const onChange = (event: MediaQueryListEvent) => setWideInfoPanel(event.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    // Filter & search
    const [activeTab, setActiveTab] = useState<'all' | 'tickets' | 'direct' | 'staff'>('all');
    // Unread messages across tickets only; non-ticket conversations never count here
    const ticketUnreadTotal = conversations.reduce((sum, c) => (isTicket(c) ? sum + (c.unreadCount || 0) : sum), 0);
    const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(convParam));

    // Linked Request Details
    const [linkedRequest, setLinkedRequest] = useState<string | null>(null);

    // New Message Dialog
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [contacts, setContacts] = useState<ContactProfile[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactRoleFilter, setContactRoleFilter] = useState<string>('all');
    const [contactChurchFilter, setContactChurchFilter] = useState<string>('all');
    const [modalError, setModalError] = useState<string | null>(null);

    // Delete Conversation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<ConversationWithDetails | null>(null);
    const [deletingType, setDeletingType] = useState<'me' | 'everyone' | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Super Admin Parish Staff Channel picker
    const [allChurches, setAllChurches] = useState<ChurchType[]>([]);
    const [showParishPickerModal, setShowParishPickerModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [parishSearch, setParishSearch] = useState('');

    const userChurchId = (profile?.assigned_church_id || profile?.church_id) || undefined;

    // Video Conference Modal
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [activeMeetingRoom, setActiveMeetingRoom] = useState<string>('');
    const [activeMeetingTitle, setActiveMeetingTitle] = useState<string>('');

    // Input state
    const [inputContent, setInputContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConversationIdRef = useRef<string | null>(activeConversationId);
    activeConversationIdRef.current = activeConversationId;

    // Active conversation object
    const activeConversation = useMemo(() => {
        const found = conversations.find((c) => c.id === activeConversationId);
        if (found) return found;

        // Instant local resolution if activeConversationId is a local conversation
        if (activeConversationId && isLocalConversation(activeConversationId)) {
            const local = getLocalConversationById(activeConversationId);
            if (local) {
                const localMsgs = getLocalMinistryMessages(local.id);
                const lastMsg = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
                return {
                    id: local.id,
                    title: local.title,
                    type: local.type as ConversationWithDetails['type'],
                    church_id: local.church_id,
                    created_by: local.created_by,
                    created_at: local.created_at,
                    updated_at: local.updated_at,
                    participants: local.participants.map((pid) => ({
                        id: `part-${pid}`,
                        conversation_id: local.id,
                        user_id: pid,
                        created_at: local.created_at,
                        last_read_at: local.updated_at,
                        profile: null,
                    })),
                    lastMessage: lastMsg,
                    unreadCount: 0,
                    church: local.church_id
                        ? ({ id: local.church_id, name: local.church_name || 'Parish Office' } as unknown as ChurchType)
                        : null,
                    otherParticipant: null,
                    ministry: PARISH_MINISTRIES.find((m) => m.name === local.title) || null,
                } as ConversationWithDetails;
            }
        }

        return null;
    }, [conversations, activeConversationId]);

    // Load conversations for the user
    const loadConversations = useCallback(async (selectFirst = false, silent = false) => {
        if (!user) return;
        try {
            if (!silent) setLoadingConversations(true);
            const { data, error } = await fetchUserConversations(user.id);
            if (error) throw error;
            const convs = (data || []).filter((c) => !(c.type === 'channel' && !c.church_id));
            setConversations(convs);
            // A Church Admin also sees one content-free stub line per ticket they escalated
            setTicketStubs(profile?.role === 'church_admin' ? await listEscalatedTicketStubs() : []);

            const directConvId = new URLSearchParams(window.location.search).get('conv') || navState?.conversationId;
            if (directConvId) {
                setActiveConversationId(directConvId);
                setMobileChatOpen(true);
            } else if (selectFirst && convs.length > 0 && !activeConversationIdRef.current) {
                setActiveConversationId(convs[0].id);
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
        } finally {
            if (!silent) setLoadingConversations(false);
        }
    }, [user, navState?.conversationId, profile?.role]);

    // Initial load
    useEffect(() => {
        loadConversations(true);
    }, [loadConversations]);

    // Sync activeConversationId if convParam changes in URL / navigation
    const handledConvParamRef = useRef<string | null>(null);
    useEffect(() => {
        if (convParam) {
            setActiveConversationId(convParam);
            setMobileChatOpen(true);
            if (user && handledConvParamRef.current !== convParam && !conversations.some((c) => c.id === convParam)) {
                handledConvParamRef.current = convParam;
                loadConversations(false);
            }
        }
    }, [convParam, user, conversations, loadConversations]);

    // Opening a ticket from a link or notification lands on the Tickets tab
    const tabSyncedForRef = useRef<string | null>(null);
    useEffect(() => {
        if (!convParam || tabSyncedForRef.current === convParam) return;
        const target = conversations.find((c) => c.id === convParam);
        if (!target) return;
        tabSyncedForRef.current = convParam;
        if (isTicket(target)) setActiveTab('tickets');
    }, [convParam, conversations]);

    // Clear any ticket error when another conversation opens, and look up the ticket a follow-up continues
    useEffect(() => {
        setTicketActionError(null);
        const linkedId = activeConversation?.linked_ticket_id;
        if (!linkedId) {
            setLinkedTicketNumber(null);
            return;
        }
        let cancelled = false;
        supabase
            .from('conversations')
            .select('ticket_number')
            .eq('id', linkedId)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setLinkedTicketNumber(data?.ticket_number ?? null);
            });
        return () => {
            cancelled = true;
        };
    }, [activeConversation?.id, activeConversation?.linked_ticket_id]);

    // Global user-level listener for incoming messages across all user conversations
    useEffect(() => {
        if (!user) return;

        const unsubscribe = subscribeToUserConversations(user.id, (incomingMsg) => {
            const currentActiveId = activeConversationIdRef.current;
            const isForActiveChat = incomingMsg.conversation_id === currentActiveId;

            if (isForActiveChat) {
                // Append message to active chat if not already present
                setMessages((prev) => {
                    if (prev.some((m) => m.id === incomingMsg.id)) return prev;
                    return [...prev, incomingMsg];
                });

                // If not sent by current user, mark read immediately
                if (incomingMsg.sender_id !== user.id) {
                    markConversationAsRead(incomingMsg.conversation_id, user.id);
                }
            }

            // A ticket's status, assignment or routing changed while this page was open: apply it now so the composer and
            // header never act on a stale status (for example a requester still typing into a ticket the church just closed)
            if (incomingMsg.message_type === 'system') {
                const meta = (incomingMsg.metadata || {}) as { event?: string; to?: string; by?: string };
                if (meta.event === 'ticket_status_changed' && meta.to) {
                    setConversations((prev) =>
                        prev.map((c) => (c.id === incomingMsg.conversation_id ? ({ ...c, status: meta.to } as ConversationWithDetails) : c))
                    );
                } else if (meta.event === 'ticket_reopened') {
                    setConversations((prev) =>
                        prev.map((c) =>
                            c.id === incomingMsg.conversation_id
                                ? ({
                                      ...c,
                                      status: 'open',
                                      reopen_count: (c.reopen_count ?? 0) + (meta.by === 'requester' ? 1 : 0),
                                  } as ConversationWithDetails)
                                : c
                        )
                    );
                } else if (meta.event?.startsWith('ticket_')) {
                    loadConversations(false, true);
                }
            }

            // Update conversations list in real-time
            setConversations((prev) => {
                const convIndex = prev.findIndex((c) => c.id === incomingMsg.conversation_id);
                if (convIndex === -1) {
                    // If conversation is brand new, reload conversations list to show it
                    loadConversations();
                    return prev;
                }

                const targetConv = prev[convIndex];
                const isFromOther = incomingMsg.sender_id !== user.id;
                const newUnreadCount = isForActiveChat
                    ? 0
                    : isFromOther
                    ? (targetConv.unreadCount || 0) + 1
                    : targetConv.unreadCount || 0;

                const updatedConv: ConversationWithDetails = {
                    ...targetConv,
                    lastMessage: incomingMsg,
                    updated_at: incomingMsg.created_at,
                    unreadCount: newUnreadCount,
                };

                // Move updated conversation to top of list
                return [
                    updatedConv,
                    ...prev.filter((c) => c.id !== incomingMsg.conversation_id),
                ];
            });
        });

        return () => {
            unsubscribe();
        };
    }, [user, loadConversations]);

    // Load churches for the Super Admin / Admin Parish Staff Channel selector and the New Ticket parish selector
    useEffect(() => {
        if (!isSuperAdmin && !canCreateTicket) return;
        const loadChurches = async () => {
            try {
                const churches = await directFetchChurches();
                setAllChurches(churches || []);
            } catch (err) {
                console.error('Failed to load churches for messaging:', err);
            }
        };
        loadChurches();
    }, [isSuperAdmin, canCreateTicket]);

    // Load messages when activeConversationId changes
    useEffect(() => {
        if (!activeConversationId || !user) return;

        let isSubscribed = true;

        const loadActiveMessages = async () => {
            setLoadingMessages(true);
            const { data, error } = await fetchMessages(activeConversationId);
            if (error) {
                console.error('Error fetching messages:', error);
            } else if (isSubscribed && activeConversationIdRef.current === activeConversationId) {
                setMessages(data || []);
                // Mark conversation as read
                await markConversationAsRead(activeConversationId, user.id);
                // Update local unread counter in list
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
                    )
                );
            }
            if (isSubscribed && activeConversationIdRef.current === activeConversationId) {
                setLoadingMessages(false);
            }
        };

        loadActiveMessages();

        // Also subscribe specifically to active conversation messages
        const unsubscribe = subscribeToMessages(activeConversationId, (incomingMsg) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
            });

            setConversations((prev) => {
                const convIndex = prev.findIndex((c) => c.id === activeConversationId);
                if (convIndex === -1) return prev;
                const targetConv = prev[convIndex];
                const updatedConv: ConversationWithDetails = {
                    ...targetConv,
                    lastMessage: incomingMsg,
                    updated_at: incomingMsg.created_at,
                    unreadCount: 0,
                };
                return [
                    updatedConv,
                    ...prev.filter((c) => c.id !== activeConversationId),
                ];
            });

            if (incomingMsg.sender_id !== user.id) {
                markConversationAsRead(activeConversationId, user.id);
            }
        });

        return () => {
            isSubscribed = false;
            unsubscribe();
        };
    }, [activeConversationId, user]);

    // Helper to get participant profile with guaranteed fallback
    const getParticipantProfile = useCallback((conv: ConversationWithDetails) => {
        if (conv.otherParticipant) return conv.otherParticipant;
        const fallback = conv.participants?.find((p) => p.user_id !== user?.id)?.profile;
        return fallback || null;
    }, [user?.id]);

    // Helper to get conversation display name
    const getDisplayName = useCallback((conv: ConversationWithDetails) => {
        if (conv.type === 'channel') {
            const rawTitle = conv.title || (conv.church?.name ? `${conv.church.name} Staff Channel` : 'Parish Staff Channel');
            return rawTitle.replace(/( Staff Channel)+$/i, ' Staff Channel');
        }
        if (conv.type === 'group' && conv.title) {
            return conv.title;
        }
        const other = getParticipantProfile(conv);
        if (other?.deleted_at) return 'Deleted User';
        if (other?.full_name?.trim()) return other.full_name.trim();
        if (other?.email?.trim()) return other.email.trim();
        return 'Parish Member';
    }, [getParticipantProfile]);

    // Load Linked Request context when activeConversation changes
    useEffect(() => {
        let isSubscribed = true;
        if (!activeConversation) {
            setLinkedRequest(null);
            return;
        }

        const other = getParticipantProfile(activeConversation);

        // The Appointment card only shows a real appointment; Staff Channels and tickets never link one.
        const targetUserId = other?.id || (activeConversation.type === 'direct' ? user?.id : null);
        if (!targetUserId || activeConversation.type !== 'direct') {
            setLinkedRequest(null);
            return;
        }

        const fetchLinkedAppointment = async () => {
            try {
                const { data } = await supabase
                    .from('appointments')
                    .select('service_type, appointment_date')
                    .or(`user_id.eq.${targetUserId},priest_id.eq.${targetUserId}`)
                    .order('appointment_date', { ascending: false })
                    .limit(1);

                if (!isSubscribed) return;
                if (data && data.length > 0 && data[0].appointment_date) {
                    const appt = data[0];
                    const serviceName = appt.service_type
                        ? appt.service_type.charAt(0).toUpperCase() + appt.service_type.slice(1).replace(/_/g, ' ')
                        : 'Sacramental Request';
                    const dateStr = new Date(appt.appointment_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    });
                    setLinkedRequest(`${serviceName} · ${dateStr}`);
                } else {
                    setLinkedRequest(null);
                }
            } catch {
                if (isSubscribed) setLinkedRequest(null);
            }
        };
        fetchLinkedAppointment();

        return () => {
            isSubscribed = false;
        };
    }, [activeConversation, user?.id, getParticipantProfile]);

    // Return to the conversation list on small screens; drops ?conv= so the URL sync does not reopen the thread
    const closeMobileChat = useCallback(() => {
        setMobileChatOpen(false);
        setSearchParams({}, { replace: true });
    }, [setSearchParams]);

    // Back bar for the thread pane's empty states, which have no chat header to carry the back button
    const mobileBackBar = (
        <div className="md:hidden p-2 border-b border-border/70 bg-white shrink-0">
            <button
                type="button"
                onClick={closeMobileChat}
                className="inline-flex items-center gap-1.5 min-h-10 px-2.5 rounded-lg text-sm font-semibold text-secondary-700 hover:text-foreground hover:bg-secondary-100 cursor-pointer"
            >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to messages</span>
            </button>
        </div>
    );

    // Handle "Delete for Me"
    const handleDeleteForMe = async () => {
        const targetConv = conversationToDelete || activeConversation;
        if (!targetConv || !user) return;

        if (targetConv.type === 'channel') {
            setDeleteError('Parish staff channels are permanent and cannot be deleted.');
            return;
        }

        try {
            setDeletingType('me');
            setDeleteError(null);
            const { error } = await deleteConversationForMe(targetConv.id, user.id);
            if (error) throw error;

            setConversations((prev) => prev.filter((c) => c.id !== targetConv.id));
            if (activeConversationId === targetConv.id) {
                setActiveConversationId(null);
                setMessages([]);
                closeMobileChat();
            }
            setShowDeleteModal(false);
            setConversationToDelete(null);
        } catch (err: unknown) {
            console.error('Error deleting conversation for me:', err);
            const message = err instanceof Error ? err.message : 'Failed to remove conversation.';
            setDeleteError(message);
        } finally {
            setDeletingType(null);
        }
    };

    // Handle "Delete for Everyone"
    const handleDeleteForEveryone = async () => {
        const targetConv = conversationToDelete || activeConversation;
        if (!targetConv) return;

        if (targetConv.type === 'channel') {
            setDeleteError('Parish staff channels are permanent and cannot be deleted.');
            return;
        }

        try {
            setDeletingType('everyone');
            setDeleteError(null);
            const { error } = await deleteConversationForEveryone(targetConv.id);
            if (error) throw error;

            setConversations((prev) => prev.filter((c) => c.id !== targetConv.id));
            if (activeConversationId === targetConv.id) {
                setActiveConversationId(null);
                setMessages([]);
                closeMobileChat();
            }
            setShowDeleteModal(false);
            setConversationToDelete(null);
        } catch (err: unknown) {
            console.error('Error deleting conversation for everyone:', err);
            const message = err instanceof Error ? err.message : 'Failed to delete conversation for everyone.';
            setDeleteError(message);
        } finally {
            setDeletingType(null);
        }
    };

    // Auto-scroll messages viewport to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loadingMessages]);

    // Handle sending a standard text message
    const handleSendMessage = async () => {
        if (!inputContent.trim() || !activeConversationId || !user || sending) return;

        const textToSend = inputContent.trim();
        const sendingTo = activeConversationId;
        const sendingToTicket = isTicket(activeConversation);
        setInputContent('');
        setSending(true);

        try {
            const { data: newMsg, error } = await sendMessage(
                activeConversationId,
                user.id,
                textToSend,
                'text'
            );

            if (error) throw error;

            if (newMsg) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });

                // Update conversation list preview
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === activeConversationId
                            ? { ...c, lastMessage: newMsg, updated_at: newMsg.created_at }
                            : c
                    )
                );
            }
        } catch (err) {
            console.error('Error sending message:', err);
            // The database refused it (for example the ticket was closed meanwhile): give the text back to the sender,
            // say so, and refresh the ticket so the composer reflects the real status
            if (activeConversationIdRef.current === sendingTo) setInputContent((current) => current || textToSend);
            toast.error(
                sendingToTicket
                    ? 'Your message was not sent. This ticket may have been closed or changed, so it was refreshed.'
                    : 'Your message was not sent. Please try again.'
            );
            await loadConversations(false, true);
        } finally {
            setSending(false);
        }
    };

    // Reopen a closed ticket; the database enforces the requester's two-reopen limit and writes the system note
    const handleReopenTicket = async () => {
        if (!activeConversation || !user || reopeningTicket) return;
        const ticketId = activeConversation.id;
        const asRequester = closedTicketRole === 'requester';
        setReopeningTicket(true);
        setTicketActionError(null);
        try {
            const { error } = await reopenTicket(ticketId);
            if (error) throw error;
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === ticketId
                        ? ({ ...c, status: 'open', reopen_count: (c.reopen_count ?? 0) + (asRequester ? 1 : 0) } as ConversationWithDetails)
                        : c
                )
            );
            toast.success('Ticket reopened.');
            const { data: fresh } = await fetchMessages(ticketId);
            if (fresh && activeConversationIdRef.current === ticketId) setMessages(fresh);
        } catch (err) {
            console.error('Error reopening ticket:', err);
            const message = err instanceof Error ? err.message : 'Could not reopen this ticket.';
            setTicketActionError(message);
            toast.error(message);
        } finally {
            setReopeningTicket(false);
        }
    };

    // After the New Ticket dialog succeeds, land directly in the new ticket thread
    const handleTicketCreated = async (conversationId: string, message = 'Ticket created. You will be notified when it is answered.') => {
        toast.success(message);
        setShowTicketModal(false);
        setActiveTab('tickets');
        setTicketStatusFilter('all');
        setSearchParams({ conv: conversationId });
        await loadConversations();
        setActiveConversationId(conversationId);
        setMobileChatOpen(true);
    };

    // Handle initiating an instant video/audio call
    const handleStartVideoCall = async (conversation?: ConversationWithDetails | null) => {
        const targetConv = conversation || activeConversation;
        if (!targetConv || !user) return;

        const roomName = generateMeetingRoomName(targetConv.id);
        const title =
            targetConv.type === 'channel'
                ? targetConv.title || 'Parish Staff Video Call'
                : targetConv.type === 'group'
                ? `${targetConv.title || 'Ministry'} Group Video Call`
                : `Call with ${targetConv.otherParticipant?.full_name || 'Parish Member'}`;

        // Send a call invite message into the chat
        try {
            const inviteContent = `📹 Started an instant Video & Audio Conference meeting. Room ID: ${roomName}`;
            const { data: callMsg } = await sendMessage(
                targetConv.id,
                user.id,
                inviteContent,
                'call_invite',
                { roomName, meetingTitle: title, initiatedBy: profile?.full_name }
            );

            if (callMsg) {
                setMessages((prev) => [...prev, callMsg]);
            }
        } catch (err) {
            console.error('Error broadcasting call invite:', err);
        }

        // Open local video conference modal
        setActiveMeetingRoom(roomName);
        setActiveMeetingTitle(title);
        setVideoModalOpen(true);
    };

    // Join an existing call from a call invite message
    const handleJoinCall = (roomName: string, title?: string) => {
        setActiveMeetingRoom(roomName);
        setActiveMeetingTitle(title || activeConversation?.title || 'Parish Video Conference');
        setVideoModalOpen(true);
    };

    // Open "New Message" contact picker
    const handleOpenNewChatModal = async () => {
        setModalError(null);
        setShowNewChatModal(true);
        if (!user) return;
        setLoadingContacts(true);
        try {
            const [contactsRes, churchesRes] = await Promise.allSettled([
                fetchAvailableContacts(),
                directFetchChurches(),
            ]);
            if (contactsRes.status === 'fulfilled') {
                if (contactsRes.value.error) throw contactsRes.value.error;
                setContacts(contactsRes.value.data || []);
            } else {
                console.error('Error fetching contacts in modal:', contactsRes.reason);
            }
            if (churchesRes.status === 'fulfilled' && churchesRes.value) {
                setAllChurches(churchesRes.value);
            }
        } catch (err) {
            console.error('Error fetching contacts in modal:', err);
        } finally {
            setLoadingContacts(false);
        }
    };

    // Select a contact from New Message modal
    const handleSelectContact = async (contactUser: ContactProfile | Profile) => {
        if (!user) return;

        // The picker lists only people the database lets this role start a chat with (list_direct_contacts)
        setShowNewChatModal(false);
        setModalError(null);
        try {
            setLoadingConversations(true);
            const { conversationId, error } = await getOrCreateDirectConversation(
                user.id,
                contactUser.id
            );
            if (error) throw error;
            if (conversationId) {
                // Point the URL at the new thread first so the ?conv= sync does not snap back to the previous one
                setSearchParams({ conv: conversationId });
                await loadConversations();
                setActiveConversationId(conversationId);
                setMobileChatOpen(true);
            }
        } catch (err: unknown) {
            console.error('Error starting direct chat:', err);
            const message = err instanceof Error ? err.message : 'Failed to start conversation.';
            alert(message);
        } finally {
            setLoadingConversations(false);
        }
    };

    // Open or create Parish Staff Channel
    const handleOpenChurchStaffChannel = async (targetChurchId?: string, targetChurchName?: string) => {
        if (!user || !isStaff) return;

        let churchId: string | undefined;

        if (isSuperAdmin) {
            // Super Admin & Admin can pick any parish channel or open targetChurchId
            if (targetChurchId) {
                churchId = targetChurchId;
            } else {
                try {
                    const churches = await directFetchChurches();
                    if (churches) setAllChurches(churches);
                } catch (err) {
                    console.error('Error refreshing churches for parish picker:', err);
                }
                setShowParishPickerModal(true);
                return;
            }
        } else {
            // Parish staff (church_admin, priest, volunteer) only access their dedicated church
            churchId = userChurchId;
            if (!churchId) {
                console.warn('Parish staff has no assigned church.');
                return;
            }
        }

        if (!churchId) return;

        try {
            setLoadingConversations(true);
            setShowParishPickerModal(false);
            const { conversationId, error } = await getOrCreateChurchStaffChannel(
                churchId,
                user.id,
                targetChurchName ? `${targetChurchName} Staff Channel` : undefined
            );
            if (error) throw error;
            if (conversationId) {
                // Point the URL at the new thread first so the ?conv= sync does not snap back to the previous one
                setSearchParams({ conv: conversationId });
                await loadConversations();
                setActiveConversationId(conversationId);
                setMobileChatOpen(true);
            }
        } catch (err) {
            console.error('Error opening church staff channel:', err);
        } finally {
            setLoadingConversations(false);
        }
    };

    // Filter conversations
    const filteredConversations = useMemo(() => {
        let list = conversations;
        if (!isStaff) {
            list = list.filter((c) => c.type === 'direct' || c.type === 'group' || isLocalConversation(c.id));
        }

        // Apply Tab Filter
        // Tickets live only under Tickets; All, Direct and Staff never show one
        if (activeTab === 'tickets') {
            list = list.filter((c) => isTicket(c));
            if (ticketStatusFilter !== 'all') {
                list = list.filter((c) => (c.status || 'open') === ticketStatusFilter);
            }
        } else {
            list = list.filter((c) => !isTicket(c));
            if (activeTab === 'direct') {
                list = list.filter((c) => c.type === 'direct');
            } else if (activeTab === 'staff') {
                list = list.filter((c) => c.type === 'channel');
            }
        }

        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((c) => {
            const title = getDisplayName(c);
            const other = getParticipantProfile(c);
            const email = other?.email;
            const churchName = c.church?.name;
            const lastMsg = c.lastMessage?.content;
            const ticketNum = c.ticket_number;
            return (
                (title && title.toLowerCase().includes(q)) ||
                (email && email.toLowerCase().includes(q)) ||
                (churchName && churchName.toLowerCase().includes(q)) ||
                (lastMsg && lastMsg.toLowerCase().includes(q)) ||
                (ticketNum && ticketNum.toLowerCase().includes(q))
            );
        });
    }, [conversations, activeTab, ticketStatusFilter, searchQuery, isStaff, getDisplayName, getParticipantProfile]);

    // Filter contacts in New Message modal
    const filteredContacts = useMemo(() => {
        let result = [...contacts];

        if (contactRoleFilter === 'church_admin') {
            result = result.filter(
                (c) => c.role === 'church_admin' && (profile?.role !== 'user' || !c.is_priest)
            );
        } else if (contactRoleFilter === 'super_admin') {
            result = result.filter((c) => c.role === 'super_admin');
        } else if (contactRoleFilter !== 'all') {
            result = result.filter((c) => (c.role || 'user') === contactRoleFilter);
        }

        if (contactChurchFilter !== 'all') {
            result = result.filter((c) => {
                const cChurchId = c.assigned_church?.id || c.assigned_church_id || c.church_id;
                return cChurchId === contactChurchFilter;
            });
        }

        if (contactSearch.trim()) {
            const q = contactSearch.toLowerCase();
            result = result.filter((c) => {
                const name = (c.full_name || '').toLowerCase();
                const email = (c.email || '').toLowerCase();
                const churchName = (c.assigned_church?.name || c.church?.name || '').toLowerCase();
                return name.includes(q) || email.includes(q) || churchName.includes(q);
            });
        }
        return result;
    }, [contacts, contactRoleFilter, contactChurchFilter, contactSearch, profile?.role]);

    // Filtered parishes for Super Admin modal
    const filteredParishes = useMemo(() => {
        if (!parishSearch.trim()) return allChurches;
        const q = parishSearch.toLowerCase();
        return allChurches.filter(
            (c) => c.name.toLowerCase().includes(q) || (c.address && c.address.toLowerCase().includes(q))
        );
    }, [allChurches, parishSearch]);

    // Ticket rules mirrored from the database (src/lib/tickets.ts); the database stays the authority
    const viewer = {
        id: user?.id,
        role: profile?.role,
        church_id: profile?.church_id,
        assigned_church_id: profile?.assigned_church_id,
    };
    const activeIsTicket = isTicket(activeConversation);
    // Who may reopen a closed ticket: its handler without limit, its requester up to MAX_REQUESTER_REOPENS times
    const closedTicketRole: 'handler' | 'requester' | null = !activeIsTicket
        ? null
        : canHandleTicket(activeConversation, profile)
          ? 'handler'
          : isTicketRequester(activeConversation, user)
            ? 'requester'
            : null;
    const reopensUsed = activeConversation?.reopen_count ?? 0;
    const canHandleActive = canHandleTicket(activeConversation, viewer);
    const activeLaneLabel = ticketLaneLabel(activeConversation);
    const offerReviewRequest = Boolean(
        activeConversation && shouldOfferReviewRequest(activeConversation, viewer, messages)
    );
    const noDirectContacts = false;
    const visibleStubs = useMemo(() => {
        if (activeTab !== 'tickets' || ticketStatusFilter !== 'all') return [];
        const q = searchQuery.trim().toLowerCase();
        return q ? ticketStubs.filter((stub) => stub.ticket_number.toLowerCase().includes(q)) : ticketStubs;
    }, [activeTab, ticketStatusFilter, searchQuery, ticketStubs]);

    // Ask the Super Admin to review a church ticket nobody answered for 7 days
    const handleRequestReview = async () => {
        if (!activeConversation || requestingReview) return;
        setRequestingReview(true);
        setTicketActionError(null);
        const { error } = await requestTicketReview(activeConversation.id);
        if (error) {
            setTicketActionError(error.message);
            toast.error(error.message);
        } else {
            toast.success('Review requested. The Super Admin has been notified.');
            await loadConversations();
        }
        setRequestingReview(false);
    };

    // Super Admin evidence for a deletion request or a report about a person
    const renderReviewPanel = () =>
        isSuperAdmin &&
        activeConversation &&
        activeIsTicket &&
        (activeConversation.category === 'user_deletion_request' || activeConversation.category === 'report_person') &&
        activeConversation.subject_user_id ? (
            <ReviewSummaryPanel
                key={activeConversation.subject_user_id}
                subjectUserId={activeConversation.subject_user_id}
                decision={
                    activeConversation.category === 'user_deletion_request' && activeConversation.id
                        ? {
                              ticketId: activeConversation.id,
                              ticketStatus: activeConversation.status,
                              onChanged: () => loadConversations(),
                          }
                        : undefined
                }
            />
        ) : null;

    return (
        <div className="flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100vh-8rem)] min-h-[520px] w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 overflow-hidden">
            {/* Top Bar Header */}
            <div
                className={`flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0 min-w-0 ${
                    mobileChatOpen ? 'hidden md:flex' : 'flex'
                }`}
            >
                <div>
                    <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                        Messages
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-1">
                        Talk with clergy, parish staff and parishioners in real time
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
                    {/* Staff channel button - guarded by isStaff */}
                    {isStaff && (
                        <button
                            type="button"
                            onClick={() => handleOpenChurchStaffChannel()}
                            className="bg-white hover:bg-secondary-50 text-secondary-800 border border-border rounded-xl px-3.5 sm:px-4 py-2 min-h-10 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                            <Church className="w-4 h-4 text-secondary-600" />
                            <span>Staff channel</span>
                        </button>
                    )}

                    {canCreateTicket && (
                        <button
                            type="button"
                            onClick={() => setShowTicketModal(true)}
                            className="bg-white hover:bg-secondary-50 text-secondary-800 border border-border rounded-xl px-3.5 sm:px-4 py-2 min-h-10 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                            <Mail className="w-4 h-4 text-secondary-600" />
                            <span>New Ticket</span>
                        </button>
                    )}

                    {/* + New message button */}
                    <button
                        type="button"
                        onClick={handleOpenNewChatModal}
                        className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4 py-2 min-h-10 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New message</span>
                    </button>
                </div>
            </div>

            {/* Informative message banner (e.g. redirected from Contact Parish) */}
            {infoMessage && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2 flex-shrink-0">
                    <Sparkles className="w-4 h-4 flex-shrink-0 text-primary" />
                    <span className="truncate">{infoMessage}</span>
                </div>
            )}

            {/* Main 3-Column Card Layout */}
            <div className="flex-1 min-h-0 bg-white border border-border/80 rounded-2xl shadow-xs overflow-hidden flex w-full">
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* COLUMN 1: CONVERSATIONS LIST                                   */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div
                    className={`w-full md:w-80 lg:w-84 xl:w-90 border-r border-border/80 flex flex-col bg-white shrink-0 min-w-0 overflow-hidden ${
                        mobileChatOpen ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {/* Search Input */}
                    <div className="p-3.5 border-b border-border/70 flex-shrink-0 space-y-2.5">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search conversations or tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3.5 py-2 min-h-10 rounded-xl border border-border text-sm bg-white placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            />
                        </div>

                        {/* Category & Type Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-secondary-100/60 rounded-xl overflow-x-auto text-[11px] sm:text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setActiveTab('all')}
                                className={`flex-1 py-2 min-h-10 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap ${
                                    activeTab === 'all'
                                        ? 'bg-white text-primary shadow-2xs font-bold'
                                        : 'text-secondary-600 hover:text-foreground'
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('tickets')}
                                className={`flex-1 py-2 min-h-10 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap ${
                                    activeTab === 'tickets'
                                        ? 'bg-white text-primary shadow-2xs font-bold'
                                        : 'text-secondary-600 hover:text-foreground'
                                }`}
                            >
                                Tickets
                                {ticketUnreadTotal > 0 && (
                                    <span
                                        data-testid="tickets-tab-badge"
                                        className="ml-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white align-middle"
                                    >
                                        {ticketUnreadTotal > 99 ? '99+' : ticketUnreadTotal}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('direct')}
                                className={`flex-1 py-2 min-h-10 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap ${
                                    activeTab === 'direct'
                                        ? 'bg-white text-primary shadow-2xs font-bold'
                                        : 'text-secondary-600 hover:text-foreground'
                                }`}
                            >
                                Direct
                            </button>
                            {isStaff && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('staff')}
                                    className={`flex-1 py-2 min-h-10 px-2.5 rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap ${
                                        activeTab === 'staff'
                                            ? 'bg-white text-primary shadow-2xs font-bold'
                                            : 'text-secondary-600 hover:text-foreground'
                                    }`}
                                >
                                    Staff
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Ticket status filter pills */}
                    {activeTab === 'tickets' && (
                        <div
                            className="px-3.5 py-2 border-b border-border/70 flex items-center gap-1.5 overflow-x-auto flex-shrink-0"
                            role="group"
                            aria-label="Filter tickets by status"
                        >
                            {([
                                { id: 'all', label: 'All' },
                                { id: 'open', label: 'Open' },
                                { id: 'in_progress', label: 'In Progress' },
                                { id: 'resolved', label: 'Resolved' },
                                { id: 'closed', label: 'Closed' },
                            ] as const).map((pill) => (
                                <button
                                    key={pill.id}
                                    type="button"
                                    onClick={() => setTicketStatusFilter(pill.id)}
                                    aria-pressed={ticketStatusFilter === pill.id}
                                    className={`px-3 py-1.5 min-h-10 lg:min-h-8 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-colors cursor-pointer ${
                                        ticketStatusFilter === pill.id
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white text-secondary-600 border-border hover:bg-secondary-50'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                        {loadingConversations ? (
                            <div className="p-8 text-center space-y-2">
                                <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent mx-auto" />
                                <p className="text-xs text-secondary-400 font-medium">Loading conversations...</p>
                            </div>
                        ) : filteredConversations.length === 0 && visibleStubs.length === 0 ? (
                            <div className="p-8 text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-secondary-100 mx-auto flex items-center justify-center text-secondary-400">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {activeTab === 'tickets' ? 'No tickets yet' : 'No conversations yet'}
                                    </p>
                                    <p className="text-xs text-secondary-500 mt-0.5">
                                        {activeTab === 'tickets'
                                            ? 'Tickets you open or handle appear here.'
                                            : noDirectContacts
                                            ? 'Open a ticket to reach the parish office.'
                                            : 'Start a new conversation with the people you can message.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenNewChatModal}
                                    className="bg-primary hover:bg-blue-700 text-white text-xs px-3.5 py-2 min-h-10 rounded-xl font-semibold inline-flex items-center gap-1.5 mx-auto cursor-pointer shadow-xs transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Start Chat</span>
                                </button>
                            </div>
                        ) : (
                            <>
                            {visibleStubs.map((stub) => (
                                <div
                                    key={stub.ticket_number}
                                    data-testid="escalated-ticket-stub"
                                    aria-disabled="true"
                                    className="p-3.5 flex items-center gap-3 w-full min-w-0 bg-secondary-50/50 cursor-default"
                                >
                                    <div className="w-10 h-10 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center shrink-0">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm font-bold text-secondary-700 truncate">
                                            {`${stub.ticket_number} · Escalated to Super Admin`}
                                        </p>
                                        <p className="text-[11px] text-secondary-400 mt-0.5">
                                            Escalated {formatConversationDate(stub.escalated_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {filteredConversations.map((conv) => {
                                const isSelected = conv.id === activeConversationId;
                                const isChannel = conv.type === 'channel';
                                const isGroup = conv.type === 'group';
                                const displayName = getDisplayName(conv);
                                const otherProf = getParticipantProfile(conv);
                                const initials = isChannel ? 'CH' : isGroup ? 'IN' : getInitials(displayName, otherProf?.email);
                                const avatarColor = isChannel
                                    ? 'bg-blue-100 text-blue-700'
                                    : isGroup
                                    ? 'bg-amber-100 text-amber-700'
                                    : getAvatarColor(initials, conv.id || displayName);
                                const lastMsg = conv.lastMessage;
                                const isCallInvite = lastMsg?.message_type === 'call_invite';

                                let lastMsgText = 'No messages yet';
                                if (isCallInvite) {
                                    lastMsgText = '📹 Video Meeting Room Ready';
                                } else if (lastMsg?.content) {
                                    lastMsgText = lastMsg.content;
                                }

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => {
                                            setActiveConversationId(conv.id);
                                            setMobileChatOpen(true);
                                            setSearchParams({ conv: conv.id });
                                        }}
                                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors w-full min-w-0 ${
                                            isSelected
                                                ? 'bg-blue-50/50'
                                                : 'hover:bg-secondary-50/70'
                                        }`}
                                    >
                                        {/* Soft round avatar circle */}
                                        <div className="relative shrink-0">
                                            {isChannel ? (
                                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-xs">
                                                    <Church className="w-5 h-5" />
                                                </div>
                                            ) : isGroup ? (
                                                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shadow-xs">
                                                    <MessageSquare className="w-5 h-5 text-amber-700" />
                                                </div>
                                            ) : otherProf?.avatar_url && !otherProf.deleted_at ? (
                                                <img
                                                    src={otherProf.avatar_url}
                                                    alt={displayName}
                                                    className="w-10 h-10 rounded-full object-cover shrink-0 shadow-xs"
                                                />
                                            ) : (
                                                <div
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${avatarColor}`}
                                                >
                                                    {initials}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="flex items-baseline justify-between gap-2 min-w-0">
                                                <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">
                                                    <UserName name={displayName} deletedAt={!isChannel && !isGroup ? otherProf?.deleted_at : null} />
                                                </h3>
                                                <span className="text-[11px] text-secondary-400 font-medium whitespace-nowrap shrink-0">
                                                    {formatConversationDate(conv.updated_at)}
                                                </span>
                                            </div>

                                            {/* Ticket Category & Status Badge Row */}
                                            {isTicket(conv) && (
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {conv.ticket_number && (
                                                        <span className="font-mono text-[9px] font-bold text-secondary-500 bg-secondary-100/70 px-1.5 py-0.5 rounded">
                                                            {conv.ticket_number}
                                                        </span>
                                                    )}
                                                    {conv.category && (
                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${getCategoryBadge(conv.category).className}`}>
                                                            {getCategoryBadge(conv.category).emoji} {getCategoryBadge(conv.category).label}
                                                        </span>
                                                    )}
                                                    {conv.status && (
                                                        <StatusBadge domain="ticket" status={conv.status} size="sm" />
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
                                                <p className="text-xs text-secondary-500 truncate line-clamp-1 flex-1">
                                                    {lastMsgText}
                                                </p>
                                                {conv.unreadCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white shrink-0">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            </>
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* COLUMN 2: MIDDLE CHAT VIEWPORT                                 */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div
                    className={`flex-1 flex flex-col bg-white min-w-0 overflow-hidden ${
                        !mobileChatOpen ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-3 sm:p-4 border-b border-border/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-white shrink-0">
                                <div className="flex items-center gap-3 min-w-0 flex-1 basis-52">
                                    {/* Mobile Back Button */}
                                    <button
                                        type="button"
                                        onClick={closeMobileChat}
                                        className="md:hidden inline-flex items-center justify-center w-10 h-10 -ml-1.5 rounded-lg text-secondary-600 hover:text-foreground hover:bg-secondary-100 shrink-0 cursor-pointer"
                                        aria-label="Back to conversations"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>

                                    {/* Header Participant Details */}
                                    {(() => {
                                        const isChannel = activeConversation.type === 'channel';
                                        const isGroup = activeConversation.type === 'group';
                                        const otherProf = getParticipantProfile(activeConversation);
                                        const headerTitle = getDisplayName(activeConversation);
                                        const initials = isChannel ? 'CH' : isGroup ? 'IN' : getInitials(headerTitle, otherProf?.email);
                                        const avatarColor = isChannel
                                            ? 'bg-blue-100 text-blue-700'
                                            : isGroup
                                            ? 'bg-amber-100 text-amber-700'
                                            : getAvatarColor(initials, activeConversation.id || headerTitle);
                                        const roleBadge = getRoleBadge(otherProf?.role);
                                        const otherContact = otherProf as ContactProfile | null;
                                        const churchName =
                                            activeConversation.church?.name ||
                                            otherContact?.assigned_church?.name ||
                                            otherContact?.church?.name ||
                                            'Parish Community';
                                        const ticketDesk =
                                            activeLaneLabel === 'Parish office'
                                                ? 'Parish office ticket'
                                                : activeLaneLabel === 'Super Admin'
                                                ? 'Super Admin ticket'
                                                : activeLaneLabel;
                                        const headerSubtitle = isChannel
                                            ? `${activeConversation.participants?.length || 1} staff participants · ${churchName}`
                                            : activeIsTicket
                                            ? `${ticketDesk} · ${churchName}`
                                            : isGroup
                                            ? `Ministry group · ${churchName}`
                                            : `${roleBadge.label} · ${churchName}`;

                                        return (
                                            <>
                                                <div className="relative shrink-0">
                                                    {isChannel ? (
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-xs">
                                                            <Church className="w-5 h-5" />
                                                        </div>
                                                    ) : isGroup ? (
                                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shadow-xs">
                                                            <MessageSquare className="w-5 h-5 text-amber-700" />
                                                        </div>
                                                    ) : otherProf?.avatar_url && !otherProf.deleted_at ? (
                                                        <img
                                                            src={otherProf.avatar_url}
                                                            alt={headerTitle}
                                                            className="w-10 h-10 rounded-full object-cover shrink-0 shadow-xs"
                                                        />
                                                    ) : (
                                                        <div
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${avatarColor}`}
                                                        >
                                                            {initials}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
                                                        <h2 className="font-bold text-foreground text-sm sm:text-base truncate leading-tight min-w-0 max-w-full">
                                                            <UserName name={headerTitle} deletedAt={!isChannel && !isGroup ? otherProf?.deleted_at : null} />
                                                        </h2>
                                                        {activeIsTicket && (
                                                            <span className="font-mono text-[10px] font-bold text-secondary-600 bg-secondary-100 px-2 py-0.5 rounded-md border border-secondary-200">
                                                                {activeConversation.ticket_number}
                                                            </span>
                                                        )}
                                                        {activeIsTicket && activeLaneLabel && (
                                                            <span
                                                                data-testid="ticket-lane"
                                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                                                    activeConversation.escalated_at
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                        : 'bg-secondary-50 text-secondary-600 border-secondary-200'
                                                                }`}
                                                            >
                                                                {activeLaneLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-secondary-500 truncate mt-0.5">
                                                        {headerSubtitle}
                                                    </p>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Right Actions: Start Video Call & Responsive Delete */}
                                <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full ml-auto">
                                    {/* Ticket Status Selector for Clergy & Staff or Status Badge for Parishioner (Only for inquiries/tickets) */}
                                    {activeIsTicket && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <TicketEscalationActions
                                                conversation={activeConversation}
                                                viewer={viewer}
                                                requesterRole={
                                                    activeConversation.participants?.find(
                                                        (part) => part.user_id === activeConversation.created_by
                                                    )?.profile?.role
                                                }
                                                onChanged={() => loadConversations()}
                                            />
                                            {canHandleActive ? (
                                                <div className="relative">
                                                    <select
                                                        disabled={updatingTicketStatus}
                                                        value={activeConversation.status || 'open'}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed';
                                                            setUpdatingTicketStatus(true);
                                                            setTicketActionError(null);
                                                            try {
                                                                const { error: statusError } = await updateTicketStatus(activeConversation.id, newStatus);
                                                                if (statusError) throw statusError;
                                                                toast.success(`Status changed to ${STATUS_DEFINITIONS.ticket[newStatus].label}.`);
                                                                // Update local state in conversations and activeConversation
                                                                setConversations((prev) =>
                                                                    prev.map((c) =>
                                                                        c.id === activeConversation.id
                                                                            ? { ...c, status: newStatus }
                                                                            : c
                                                                    )
                                                                );
                                                            } catch (err) {
                                                                // The list keeps the old status, so the dropdown snaps back to it
                                                                console.error('Failed to update ticket status:', err);
                                                                const message = err instanceof Error ? err.message : 'Could not change the ticket status.';
                                                                setTicketActionError(message);
                                                                toast.error(message);
                                                            } finally {
                                                                setUpdatingTicketStatus(false);
                                                            }
                                                        }}
                                                        className="text-xs font-semibold py-2 min-h-10 pl-2.5 pr-7 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 max-w-full"
                                                    >
                                                        <option value="open">🔵 Open</option>
                                                        <option value="in_progress">🟡 In Progress</option>
                                                        <option value="resolved">🟢 Resolved</option>
                                                        <option value="closed">⚪ Closed</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <StatusBadge domain="ticket" status={activeConversation.status} />
                                            )}
                                        </div>
                                    )}

                                    {/* Video call restricted to staff & clergy only */}
                                    {VIDEO_CALLS_ENABLED && isStaff && (
                                        <button
                                            type="button"
                                            onClick={() => handleStartVideoCall(activeConversation)}
                                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 min-h-10 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Start video call</span>
                                        </button>
                                    )}

                                    {/* Responsive delete button for screen sizes where Column 3 is hidden */}
                                    {activeConversation.type !== 'channel' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setConversationToDelete(activeConversation);
                                                setShowDeleteModal(true);
                                            }}
                                            className="2xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border text-secondary-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                                            title="Delete conversation"
                                            aria-label="Delete conversation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Who handles a parish office ticket, with the Church Admin's assign picker */}
                            {activeIsTicket && activeConversation.ticket_lane === 'church' && !activeConversation.escalated_at && (
                                <TicketAssignment
                                    ticketId={activeConversation.id}
                                    churchId={activeConversation.church_id}
                                    assignedTo={activeConversation.assigned_to ?? null}
                                    canAssign={
                                        profile?.role === 'church_admin' &&
                                        canHandleActive &&
                                        activeConversation.status !== 'closed'
                                    }
                                    onChanged={() => loadConversations()}
                                />
                            )}

                            {/* Ticket notices: follow-up link, review request and status errors */}
                            {activeIsTicket && (
                                (linkedTicketNumber || activeConversation.linked_ticket_id || offerReviewRequest || ticketActionError) && (
                                    <div className="px-3 sm:px-4 py-2.5 border-b border-border/70 bg-secondary-50/40 space-y-2 shrink-0 min-w-0">
                                        {activeConversation.linked_ticket_id && (
                                            <p className="text-xs font-medium text-secondary-600">
                                                Follow-up to {linkedTicketNumber || 'an earlier ticket'}
                                            </p>
                                        )}
                                        {offerReviewRequest && (
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <p className="text-xs text-secondary-600">
                                                    No reply for 7 days? The Super Admin can step in and review this ticket.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleRequestReview}
                                                    disabled={requestingReview}
                                                    className="px-3 py-2 min-h-10 rounded-xl border border-primary/40 text-primary hover:bg-blue-50 disabled:opacity-50 text-xs font-semibold sm:shrink-0 cursor-pointer transition-colors"
                                                >
                                                    {requestingReview ? 'Asking...' : 'Ask the Super Admin to review'}
                                                </button>
                                            </div>
                                        )}
                                        {ticketActionError && (
                                            <div
                                                role="alert"
                                                data-testid="ticket-action-error"
                                                className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2"
                                            >
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                <span>{ticketActionError}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            {/* Message Thread */}
                            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-white min-w-0">
                                {/* Review panel for the Super Admin when the right-hand info panel is not shown; it scrolls with the thread so its decision buttons are always reachable */}
                                {!wideInfoPanel && renderReviewPanel()}
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                                        <div className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center">
                                            <MessageSquare className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm sm:text-base font-bold text-foreground">
                                                Start of conversation
                                            </h4>
                                            <p className="text-xs text-secondary-500 max-w-sm mt-1">
                                                Send your first message to begin coordinating.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isCurrentUser = msg.sender_id === user?.id;
                                        const isCallInvite = msg.message_type === 'call_invite';
                                        interface CallMetadata {
                                            roomName?: string;
                                            meetingTitle?: string;
                                            initiatedBy?: string;
                                        }
                                        const meta = (msg.metadata as CallMetadata | null) || {};

                                        if (isCallInvite && !VIDEO_CALLS_ENABLED) return null;

                                        if (isCallInvite) {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <div className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/50 flex items-center justify-between gap-3 max-w-sm w-full shadow-xs">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                                                <Video className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                                                                    Parish video conference
                                                                </h4>
                                                                <p className="text-[11px] text-emerald-700 font-medium truncate">
                                                                    Room ready · {formatMessageTime(msg.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleJoinCall(
                                                                    meta.roomName || 'sacralink-room',
                                                                    meta.meetingTitle
                                                                )
                                                            }
                                                            className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors shrink-0"
                                                        >
                                                            Join
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (msg.message_type === 'system') {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-1">
                                                    <span className="text-[11px] font-medium text-secondary-500 bg-secondary-100/70 border border-border/60 rounded-full px-3 py-1">
                                                        {msg.content} · {formatMessageTime(msg.created_at)}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        if (isCurrentUser) {
                                            const isMultiParty = activeConversation.type === 'group' || activeConversation.type === 'channel';
                                            const myName = profile?.full_name?.trim() || user.email?.split('@')[0] || 'You';
                                            const myInitials = getInitials(myName, user.email);
                                            const myRoleInfo = getRoleBadge(profile?.is_priest ? 'priest' : profile?.role);

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className="flex flex-col items-end self-end max-w-[85%] sm:max-w-md ml-auto"
                                                >
                                                    <div className="flex items-end gap-2.5 min-w-0 w-full justify-end">
                                                        <div className="bg-primary text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-2xs min-w-0">
                                                            {isMultiParty && (
                                                                <div className="flex items-center gap-1.5 justify-end mb-1">
                                                                    <span className="font-bold text-[11px] text-blue-100 truncate">
                                                                        {myName}
                                                                    </span>
                                                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-white/20 text-white">
                                                                        {myRoleInfo.label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed text-left">
                                                                {msg.content}
                                                            </p>
                                                        </div>

                                                        {isMultiParty && (
                                                            profile?.avatar_url ? (
                                                                <img
                                                                    src={profile.avatar_url}
                                                                    alt={myName}
                                                                    className="w-7 h-7 rounded-full object-cover shrink-0 shadow-2xs"
                                                                />
                                                            ) : (
                                                                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 border border-primary/30">
                                                                    {myInitials}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-secondary-400 mt-1 pr-1">
                                                        <span>{formatMessageTime(msg.created_at)}</span>
                                                        <CheckCheck className="w-3 h-3 text-secondary-400" />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const senderDeleted = Boolean(msg.sender?.deleted_at);
                                        const senderName = senderDeleted ? 'Deleted User' : msg.sender?.full_name?.trim() || 'Staff Member';
                                        const senderInitials = getInitials(senderName, msg.sender?.email);
                                        const roleInfo = getRoleBadge(
                                            msg.sender?.is_priest ? 'priest' : msg.sender?.role
                                        );

                                        return (
                                            <div
                                                key={msg.id}
                                                className="flex flex-col items-start max-w-[85%] sm:max-w-md"
                                            >
                                                <div className="flex items-end gap-2.5 min-w-0 w-full">
                                                    {msg.sender?.avatar_url && !senderDeleted ? (
                                                        <img
                                                            src={msg.sender.avatar_url}
                                                            alt={senderName}
                                                            className="w-8 h-8 rounded-full object-cover shrink-0 shadow-2xs"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-secondary-100 text-secondary-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                                            {senderInitials}
                                                        </div>
                                                    )}

                                                    <div className="bg-secondary-100/70 text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-2xs min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="font-bold text-xs text-foreground truncate">
                                                                <UserName name={senderName} deletedAt={msg.sender?.deleted_at} />
                                                            </span>
                                                            <span
                                                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ${roleInfo.className}`}
                                                            >
                                                                {roleInfo.label}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                            {msg.content}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-secondary-400 mt-1 pl-10.5">
                                                    {formatMessageTime(msg.created_at)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Bottom Input Bar */}
                            <div className="p-3 sm:p-4 border-t border-border/70 bg-white shrink-0 min-w-0">
                                {activeIsTicket && activeConversation.status === 'closed' ? (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-secondary-50">
                                        <div className="flex flex-col gap-0.5 text-xs sm:text-sm font-semibold text-secondary-700 min-w-0">
                                            <span className="flex items-center gap-2">
                                                <Lock className="w-4 h-4 text-secondary-500 shrink-0" />
                                                <span>This ticket is closed</span>
                                            </span>
                                            {closedTicketRole === 'requester' && (
                                                <span data-testid="reopens-used" className="pl-6 text-[11px] sm:text-xs font-medium text-secondary-500">
                                                    {reopensUsed >= MAX_REQUESTER_REOPENS
                                                        ? `All ${MAX_REQUESTER_REOPENS} reopens used`
                                                        : `${reopensUsed} of ${MAX_REQUESTER_REOPENS} reopens used`}
                                                </span>
                                            )}
                                        </div>
                                        {closedTicketRole === 'requester' && reopensUsed >= MAX_REQUESTER_REOPENS ? (
                                            <button
                                                type="button"
                                                onClick={() => setFollowUpSource(activeConversation)}
                                                className="px-4 py-2 min-h-10 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer sm:shrink-0"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Raise a new ticket</span>
                                            </button>
                                        ) : closedTicketRole ? (
                                            <button
                                                type="button"
                                                onClick={handleReopenTicket}
                                                disabled={reopeningTicket}
                                                className="px-4 py-2 min-h-10 rounded-xl bg-primary hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer sm:shrink-0"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                <span>{reopeningTicket ? 'Reopening...' : 'Reopen Ticket'}</span>
                                            </button>
                                        ) : null}
                                    </div>
                                ) : activeConversation.type === 'direct' &&
                                  (activeConversation.other_participant_blocked || getParticipantProfile(activeConversation)?.deleted_at) ? (
                                    <div
                                        role="status"
                                        data-testid="composer-unavailable"
                                        className="flex items-center gap-2 p-3 rounded-xl border border-border bg-secondary-50 text-xs sm:text-sm font-semibold text-secondary-700"
                                    >
                                        <Lock className="w-4 h-4 text-secondary-500 shrink-0" />
                                        <span>This user is no longer available</span>
                                    </div>
                                ) : activeConversation.type === 'direct' &&
                                  activeConversation.is_legacy_direct &&
                                  (profile?.role === 'user' || isVolunteer) ? (
                                    <div
                                        data-testid="legacy-direct-banner"
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-secondary-50"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-semibold text-secondary-700 flex items-center gap-2">
                                                <Lock className="w-4 h-4 text-secondary-500 shrink-0" />
                                                <span>Please open a ticket</span>
                                            </p>
                                            <p className="text-[11px] sm:text-xs text-secondary-500 mt-1">
                                                This chat is now read-only. Tickets let the parish office track and answer your message.
                                                {isVolunteer && ' You can also reach your parish team in the staff channel.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                            {isVolunteer && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenChurchStaffChannel()}
                                                    className="px-3 py-2 min-h-10 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-800 font-semibold text-xs cursor-pointer transition-colors"
                                                >
                                                    Staff channel
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setShowTicketModal(true)}
                                                className="px-4 py-2 min-h-10 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                            >
                                                <Mail className="w-4 h-4" />
                                                <span>New Ticket</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        type="text"
                                        value={inputContent}
                                        onChange={(e) => setInputContent(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 min-w-0 py-2.5 min-h-10 px-3.5 sm:px-4 rounded-xl border border-border text-sm bg-white placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    />

                                    {/* Video call restricted to staff & clergy only */}
                                    {VIDEO_CALLS_ENABLED && isStaff && (
                                        <button
                                            type="button"
                                            onClick={() => handleStartVideoCall(activeConversation)}
                                            className="p-2.5 rounded-xl border border-border text-secondary-500 hover:text-foreground hover:bg-secondary-50 transition-colors shrink-0 cursor-pointer"
                                            title="Start video meeting"
                                        >
                                            <Video className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={!inputContent.trim() || sending}
                                        className="px-3.5 sm:px-4 py-2.5 min-h-10 rounded-xl bg-primary hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                        <span>Send</span>
                                    </button>
                                </form>
                                )}
                            </div>
                        </>
                    ) : loadingConversations && activeConversationId ? (
                        <>
                            {mobileBackBar}
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
                                <p className="text-xs text-secondary-500 font-medium">Opening conversation...</p>
                            </div>
                        </>
                    ) : activeConversationId && !loadingConversations ? (
                        <>
                            {mobileBackBar}
                            <div
                                data-testid="conversation-not-found"
                                className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white"
                            >
                                <div className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <h3 className="font-serif text-lg font-bold text-foreground">Conversation not found</h3>
                                <p className="text-xs text-secondary-500 max-w-sm">
                                    It may have been removed, or you may not have access to it.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {mobileBackBar}
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white">
                            <div className="w-12 h-12 rounded-full bg-secondary-100 text-secondary-500 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <h3 className="font-serif text-lg font-bold text-foreground">
                                No conversation selected
                            </h3>
                            <p className="text-xs text-secondary-500 max-w-sm">
                                Choose a conversation from the left or start a new message.
                            </p>
                            <button
                                type="button"
                                onClick={handleOpenNewChatModal}
                                className="mt-2 bg-primary hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New message</span>
                            </button>
                        </div>
                        </>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* COLUMN 3: RIGHT DETAILS SIDEBAR                               */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {activeConversation && (
                    <div className="hidden 2xl:flex w-72 lg:w-80 border-l border-border/80 flex-col p-6 bg-white shrink-0 overflow-y-auto">
                        {(() => {
                            const isChannel = activeConversation.type === 'channel';
                            const otherProf = getParticipantProfile(activeConversation);
                            const title = getDisplayName(activeConversation);
                            const initials = isChannel ? 'CH' : getInitials(title, otherProf?.email);
                            const avatarColor = isChannel
                                ? 'bg-blue-100 text-blue-700'
                                : getAvatarColor(initials, activeConversation.id || title);
                            const roleBadge = getRoleBadge(otherProf?.role);
                            const otherContact = otherProf as ContactProfile | null;
                            const churchName =
                                activeConversation.church?.name ||
                                otherContact?.assigned_church?.name ||
                                otherContact?.church?.name ||
                                'Parish Community';
                            const email = isChannel ? activeConversation.church?.email : otherProf?.email;

                            return (
                                <div className="flex flex-col h-full">
                                    {/* Large soft circle avatar */}
                                    {isChannel ? (
                                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl mb-3 shadow-xs">
                                            <Church className="w-8 h-8" />
                                        </div>
                                    ) : otherProf?.avatar_url && !otherProf.deleted_at ? (
                                        <img
                                            src={otherProf.avatar_url}
                                            alt={title}
                                            className="w-16 h-16 rounded-full object-cover mb-3 shadow-xs"
                                        />
                                    ) : (
                                        <div
                                            className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg mb-3 shadow-xs ${avatarColor}`}
                                        >
                                            {initials}
                                        </div>
                                    )}

                                    {/* Name */}
                                    <h3 className="font-bold text-foreground text-base tracking-tight truncate">
                                        <UserName name={title} deletedAt={!isChannel ? otherProf?.deleted_at : null} />
                                    </h3>

                                    {/* Role badge */}
                                    <div className="mt-1 mb-4">
                                        <span className="bg-blue-50 text-primary border border-blue-200/80 rounded-full px-2.5 py-0.5 text-xs font-semibold inline-block">
                                            {isChannel ? 'Staff Channel' : roleBadge.label}
                                        </span>
                                    </div>

                                    {/* Parish info row */}
                                    <div className="text-xs text-secondary-600 flex items-center gap-2 mb-2 min-w-0">
                                        <Church className="w-4 h-4 text-secondary-400 shrink-0" />
                                        <span className="truncate">{churchName}</span>
                                    </div>

                                    {/* Email row */}
                                    {email && (
                                        <div className="text-xs text-secondary-600 flex items-center gap-2 mb-6 min-w-0">
                                            <Mail className="w-4 h-4 text-secondary-400 shrink-0" />
                                            <span className="truncate">{email}</span>
                                        </div>
                                    )}

                                    {/* Super Admin evidence for a deletion request or a report about a person */}
                                    {wideInfoPanel && renderReviewPanel()}

                                    {/* LINKED REQUEST / TICKET DETAILS section */}
                                    {activeIsTicket ? (
                                        <div className="mb-6 space-y-3 p-3.5 rounded-xl border border-border/80 bg-secondary-50/50">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-bold text-secondary-500 uppercase tracking-wider">
                                                    TICKET INFORMATION
                                                </span>
                                                {activeConversation.ticket_number && (
                                                    <span className="font-mono text-[10px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                        {activeConversation.ticket_number}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-2 text-xs">
                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span className="text-secondary-400">Category:</span>
                                                    <span className={`px-2 py-0.5 rounded-md font-semibold border ${getCategoryBadge(activeConversation.category).className}`}>
                                                        {getCategoryBadge(activeConversation.category).emoji} {getCategoryBadge(activeConversation.category).label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span className="text-secondary-400">Status:</span>
                                                    <StatusBadge domain="ticket" status={activeConversation.status} />
                                                </div>

                                                {activeLaneLabel && (
                                                    <div className="flex items-center justify-between text-secondary-600">
                                                        <span className="text-secondary-400">Desk:</span>
                                                        <span className="font-medium text-foreground">{activeLaneLabel}</span>
                                                    </div>
                                                )}

                                                {activeConversation.linked_ticket_id && (
                                                    <div className="flex items-center justify-between text-secondary-600">
                                                        <span className="text-secondary-400">Follow-up to:</span>
                                                        <span className="font-mono font-medium text-foreground">
                                                            {linkedTicketNumber || 'an earlier ticket'}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span className="text-secondary-400">Opened:</span>
                                                    <span className="font-medium text-foreground">
                                                        {new Date(activeConversation.created_at).toLocaleDateString([], {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : linkedRequest ? (
                                        <div className="mb-6">
                                            <p className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase mb-2">
                                                LINKED REQUEST
                                            </p>
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-secondary-50/70 text-xs font-medium text-secondary-700 max-w-full">
                                                <Calendar className="w-3.5 h-3.5 text-secondary-500 shrink-0" />
                                                <span className="truncate">{linkedRequest}</span>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Bottom Action: Delete conversation (Direct Chats Only) */}
                                    {!isChannel && (
                                        <div className="mt-auto pt-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setConversationToDelete(activeConversation);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="w-full py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors mt-auto cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Delete conversation</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* NEW CONVERSATION MODAL                                          */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <Modal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                title="New Direct Conversation"
                description={
                    profile?.role === 'user' || isVolunteer
                        ? 'Search parishioners and volunteers to start a direct message'
                        : 'Search the people you can start a conversation with'
                }
                size="lg"
            >
                {noDirectContacts ? (
                    <div data-testid="new-message-ticket-offer" className="space-y-4">
                        <p className="text-sm text-secondary-700">
                            Messages to the parish office are tickets so the office can track and answer them.
                            {isVolunteer && ' Your parish team is also in the staff channel.'}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewChatModal(false);
                                    setShowTicketModal(true);
                                }}
                                className="bg-primary hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                <span>New Ticket</span>
                            </button>
                            {isVolunteer && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNewChatModal(false);
                                        handleOpenChurchStaffChannel();
                                    }}
                                    className="bg-white hover:bg-secondary-50 text-secondary-800 border border-border font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                >
                                    <Church className="w-4 h-4 text-secondary-600" />
                                    <span>Open staff channel</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                <div className="space-y-4">
                    {(profile?.role === 'user' || isVolunteer) && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary-50 border border-border text-xs text-secondary-600">
                            <span>Need to reach parish administration?</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewChatModal(false);
                                    setShowTicketModal(true);
                                }}
                                className="text-primary hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                            >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Open a ticket</span>
                            </button>
                        </div>
                    )}
                    {modalError && (
                        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <span>{modalError}</span>
                        </div>
                    )}

                    {/* Search & Filter */}
                    <div className="space-y-2.5">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, or parish..."
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    className="input !pl-10 w-full text-xs sm:text-sm"
                                />
                            </div>

                            {/* Church Filter Dropdown */}
                            <div className="sm:w-56 flex-shrink-0">
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 pointer-events-none" />
                                    <select
                                        value={contactChurchFilter}
                                        onChange={(e) => setContactChurchFilter(e.target.value)}
                                        className="input !pl-8 !pr-7 w-full text-xs py-2 truncate bg-card border-border text-foreground appearance-none cursor-pointer"
                                    >
                                        <option value="all">All Parishes</option>
                                        {allChurches.map((ch) => (
                                            <option key={ch.id} value={ch.id}>
                                                {ch.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-secondary-400">
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                            {(profile?.role === 'priest' ? [
                                { id: 'all', label: 'All Contacts' },
                                { id: 'church_admin', label: 'Church Admins' },
                                { id: 'priest', label: 'Priests' },
                                { id: 'volunteer', label: 'Volunteers' },
                                { id: 'user', label: 'Parishioners' },
                            ] : profile?.role === 'super_admin' ? [
                                { id: 'all', label: 'All Staff' },
                                { id: 'church_admin', label: 'Church Admins' },
                                { id: 'priest', label: 'Priests' },
                                { id: 'volunteer', label: 'Volunteers' },
                            ] : profile?.role === 'user' || isVolunteer ? [
                                { id: 'all', label: 'All Contacts' },
                                { id: 'volunteer', label: 'Volunteers' },
                                { id: 'user', label: 'Parishioners' },
                            ] : [
                                { id: 'all', label: 'All Contacts' },
                                { id: 'super_admin', label: 'Super Admin' },
                                { id: 'church_admin', label: 'Church Admins' },
                                { id: 'priest', label: 'Priests' },
                                { id: 'volunteer', label: 'Volunteers' },
                                { id: 'user', label: 'Parishioners' },
                            ]).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setContactRoleFilter(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                        contactRoleFilter === tab.id
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contacts List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-border border rounded-xl">
                        {loadingContacts ? (
                            <div className="p-8 text-center space-y-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
                                <p className="text-xs text-secondary-400">Loading directory...</p>
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-8 text-center text-xs text-secondary-400">
                                No contacts found matching your search.
                            </div>
                        ) : (
                            filteredContacts.map((c) => {
                                const role = getRoleBadge(c.role);
                                const churchName = c.assigned_church?.name || c.church?.name;
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => handleSelectContact(c)}
                                        className="p-3 flex items-center justify-between hover:bg-secondary-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {c.avatar_url ? (
                                                <img
                                                    src={c.avatar_url}
                                                    alt={c.full_name || ''}
                                                    className="w-9 h-9 rounded-xl object-cover border border-border flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">
                                                    {(c.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                                    {c.full_name || 'No name'}
                                                </p>
                                                <div className="flex items-center gap-2 text-[11px] text-secondary-400 truncate">
                                                    <span className="truncate">{c.email}</span>
                                                    {churchName && (
                                                        <span className="sm:hidden flex items-center gap-0.5 text-secondary-600 font-medium truncate">
                                                            • <Building2 className="w-2.5 h-2.5 inline text-secondary-500 flex-shrink-0" />
                                                            <span className="truncate">{churchName}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {churchName && (
                                                <span
                                                    className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary-100 text-secondary-700 border border-border max-w-[170px] truncate"
                                                    title={churchName}
                                                >
                                                    <Building2 className="w-3 h-3 text-secondary-500 flex-shrink-0" />
                                                    <span className="truncate">{churchName}</span>
                                                </span>
                                            )}
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${role.className}`}
                                            >
                                                {role.label}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-secondary-400" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                )}
            </Modal>

            {/* Follow-up ticket raised from a closed ticket whose reopens ran out */}
            {followUpSource && user && (
                <ParishInquiryModal
                    isOpen
                    onClose={() => setFollowUpSource(null)}
                    parishOptions={allChurches.filter((c) => c.is_active !== false).map((c) => ({ id: c.id, name: c.name }))}
                    defaultChurchId={followUpSource.church_id}
                    churchId={followUpSource.ticket_lane === 'church' ? followUpSource.church_id : undefined}
                    userId={user.id}
                    role={profile?.role ?? undefined}
                    lane={followUpSource.ticket_lane === 'platform' ? 'platform' : 'church'}
                    linkedTicketId={followUpSource.id}
                    initialSubject={`Follow-up: ${(followUpSource.title || '').replace(/^Inquiry:\s*/, '')}`}
                    initialCategory={followUpSource.category || undefined}
                    onSuccess={(id) => {
                        setFollowUpSource(null);
                        handleTicketCreated(id, 'Follow-up ticket raised.');
                    }}
                />
            )}

            {/* New Parish Office Ticket (parish selector because no parish is pre-selected) */}
            {canCreateTicket && showTicketModal && user && (
                <ParishInquiryModal
                    isOpen={showTicketModal}
                    onClose={() => setShowTicketModal(false)}
                    parishOptions={allChurches.filter((c) => c.is_active !== false).map((c) => ({ id: c.id, name: c.name }))}
                    defaultChurchId={userChurchId}
                    userId={user.id}
                    role={profile?.role ?? undefined}
                    lane={ticketLane}
                    allowLaneChoice={isVolunteer}
                    onSuccess={(id) => handleTicketCreated(id)}
                />
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* DELETE CONVERSATION CONFIRMATION MODAL                          */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {showDeleteModal && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => {
                        if (!deletingType) {
                            setShowDeleteModal(false);
                            setConversationToDelete(null);
                            setDeleteError(null);
                        }
                    }}
                    title="Delete Conversation"
                    description={`Delete conversation with "${
                        conversationToDelete
                            ? getDisplayName(conversationToDelete)
                            : activeConversation
                            ? getDisplayName(activeConversation)
                            : 'recipient'
                    }"`}
                    size="md"
                >
                    <div className="space-y-4">
                        {deleteError && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                                <span>{deleteError}</span>
                            </div>
                        )}

                        <p className="text-xs sm:text-sm text-secondary-500">
                            Please choose how you want to delete this conversation:
                        </p>

                        <div className="space-y-3">
                            {/* Option 1: Delete for Me */}
                            <div className="p-3.5 rounded-xl border border-border hover:border-primary/40 bg-card hover:bg-secondary-50/50 transition-all flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-xl bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <UserX className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                                        Delete for Me
                                    </h4>
                                    <p className="text-[11px] sm:text-xs text-secondary-500 mt-0.5 leading-relaxed">
                                        Removes this conversation from your list only. Other participants will retain access to the chat history.
                                    </p>
                                    <div className="mt-2.5">
                                        <button
                                            type="button"
                                            disabled={!!deletingType}
                                            onClick={handleDeleteForMe}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary-100 hover:bg-secondary-200 text-secondary-800 dark:bg-secondary-800 dark:hover:bg-secondary-700 dark:text-secondary-200 border border-border transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                                        >
                                            {deletingType === 'me' ? (
                                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
                                            ) : (
                                                <UserX className="w-3.5 h-3.5" />
                                            )}
                                            <span>{deletingType === 'me' ? 'Removing...' : 'Delete for Me'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Delete for Everyone */}
                            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20 hover:border-red-300 transition-all flex items-start gap-3.5">
                                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-400">
                                        Delete for Both of Us (Everyone)
                                    </h4>
                                    <p className="text-[11px] sm:text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 leading-relaxed">
                                        Permanently deletes this conversation and its entire history for all participants.
                                    </p>
                                    <div className="mt-2.5">
                                        <button
                                            type="button"
                                            disabled={!!deletingType}
                                            onClick={handleDeleteForEveryone}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                                        >
                                            {deletingType === 'everyone' ? (
                                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                            <span>{deletingType === 'everyone' ? 'Deleting...' : 'Delete for Everyone'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-border">
                            <button
                                type="button"
                                disabled={!!deletingType}
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setConversationToDelete(null);
                                    setDeleteError(null);
                                }}
                                className="btn-secondary text-xs px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PARISH STAFF CHANNEL PICKER MODAL (Super Admin / Admin only)    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {isSuperAdmin && showParishPickerModal && (
                <Modal
                    isOpen={showParishPickerModal}
                    onClose={() => setShowParishPickerModal(false)}
                    title="Select Parish Staff Channel"
                    description="Choose a parish to connect and chat with its priests and pastoral staff"
                    className="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search parish by name or address..."
                                value={parishSearch}
                                onChange={(e) => setParishSearch(e.target.value)}
                                className="input !pl-9 w-full text-xs py-2"
                            />
                        </div>

                        <div className="max-h-72 overflow-y-auto divide-y divide-border border rounded-xl">
                            {filteredParishes.length === 0 ? (
                                <div className="p-8 text-center text-xs text-secondary-400">
                                    No parishes found.
                                </div>
                            ) : (
                                filteredParishes.map((church) => (
                                    <div
                                        key={church.id}
                                        onClick={() => handleOpenChurchStaffChannel(church.id, church.name)}
                                        className="p-3 flex items-center justify-between hover:bg-secondary-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                                    {church.name}
                                                </p>
                                                {church.address && (
                                                    <p className="text-[11px] text-secondary-400 truncate">
                                                        {church.address}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-secondary-400 flex-shrink-0" />
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowParishPickerModal(false)}
                                className="btn-secondary text-xs px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* EMBEDDED JITSI VIDEO CONFERENCING MODAL                         */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <VideoConferenceModal
                isOpen={videoModalOpen}
                onClose={() => setVideoModalOpen(false)}
                roomName={activeMeetingRoom}
                conversationTitle={activeMeetingTitle}
                participantName={profile?.full_name || 'SacraLink User'}
            />
        </div>
    );
}
