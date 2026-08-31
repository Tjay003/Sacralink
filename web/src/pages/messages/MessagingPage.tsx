import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    MessageSquare,
    Search,
    Plus,
    Send,
    Video,
    ArrowLeft,
    Building2,
    CheckCheck,
    Sparkles,
    ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
    type ConversationWithDetails,
    type MessageWithSender,
} from '../../lib/supabase/messaging';
import VideoConferenceModal from '../../components/conference/VideoConferenceModal';
import Modal from '../../components/ui/Modal';
import type { Profile } from '../../types/database';

export default function MessagingPage() {
    const { user, profile } = useAuth();

    // Data states
    const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageWithSender[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);

    // Filter & search
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileChatOpen, setMobileChatOpen] = useState(false);

    // New Message Dialog
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [contacts, setContacts] = useState<Profile[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactRoleFilter, setContactRoleFilter] = useState<string>('all');

    // Video Conference Modal
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const [activeMeetingRoom, setActiveMeetingRoom] = useState<string>('');
    const [activeMeetingTitle, setActiveMeetingTitle] = useState<string>('');

    // Input state
    const [inputContent, setInputContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Active conversation object
    const activeConversation = useMemo(() => {
        return conversations.find((c) => c.id === activeConversationId) || null;
    }, [conversations, activeConversationId]);

    // Load conversations for the user
    const loadConversations = useCallback(async (selectFirst = false) => {
        if (!user) return;
        try {
            setLoadingConversations(true);
            const { data, error } = await fetchUserConversations(user.id);
            if (error) throw error;
            const convs = data || [];
            setConversations(convs);

            if (selectFirst && convs.length > 0 && !activeConversationId) {
                setActiveConversationId(convs[0].id);
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
        } finally {
            setLoadingConversations(false);
        }
    }, [user, activeConversationId]);

    // Initial load
    useEffect(() => {
        loadConversations(true);
    }, [user]);

    // Load messages when activeConversationId changes
    useEffect(() => {
        if (!activeConversationId || !user) return;

        let isSubscribed = true;

        const loadActiveMessages = async () => {
            setLoadingMessages(true);
            const { data, error } = await fetchMessages(activeConversationId);
            if (error) {
                console.error('Error fetching messages:', error);
            } else if (isSubscribed) {
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
            if (isSubscribed) setLoadingMessages(false);
        };

        loadActiveMessages();

        // Subscribe to real-time incoming messages
        const unsubscribe = subscribeToMessages(activeConversationId, (incomingMsg) => {
            setMessages((prev) => {
                // Avoid duplicate append if already present
                if (prev.some((m) => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
            });

            // Update conversations list preview
            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id === activeConversationId) {
                        return {
                            ...c,
                            lastMessage: incomingMsg,
                            updated_at: incomingMsg.created_at,
                        };
                    }
                    return c;
                })
            );

            // Mark as read immediately if current user is looking at this chat
            if (incomingMsg.sender_id !== user.id) {
                markConversationAsRead(activeConversationId, user.id);
            }
        });

        return () => {
            isSubscribed = false;
            unsubscribe();
        };
    }, [activeConversationId, user]);

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
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    // Handle initiating an instant video/audio call
    const handleStartVideoCall = async (conversation?: ConversationWithDetails | null) => {
        const targetConv = conversation || activeConversation;
        if (!targetConv || !user) return;

        const roomName = generateMeetingRoomName(targetConv.id);
        const title =
            targetConv.type === 'channel'
                ? targetConv.title || 'Parish Staff Video Call'
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
        setShowNewChatModal(true);
        if (!user) return;
        setLoadingContacts(true);
        const userChurchId = profile?.assigned_church_id || profile?.church_id;
        const { data } = await fetchAvailableContacts(user.id, userChurchId);
        setContacts(data || []);
        setLoadingContacts(false);
    };

    // Select a contact from New Message modal
    const handleSelectContact = async (contactUser: Profile) => {
        if (!user) return;
        setShowNewChatModal(false);
        try {
            setLoadingConversations(true);
            const { conversationId, error } = await getOrCreateDirectConversation(
                user.id,
                contactUser.id
            );
            if (error) throw error;
            if (conversationId) {
                await loadConversations();
                setActiveConversationId(conversationId);
                setMobileChatOpen(true);
            }
        } catch (err) {
            console.error('Error starting direct chat:', err);
        } finally {
            setLoadingConversations(false);
        }
    };

    // Open or create Parish Staff Channel
    const handleOpenChurchStaffChannel = async () => {
        if (!user) return;
        const churchId = profile?.assigned_church_id || profile?.church_id;
        if (!churchId) return;

        try {
            setLoadingConversations(true);
            const { conversationId, error } = await getOrCreateChurchStaffChannel(
                churchId,
                user.id
            );
            if (error) throw error;
            if (conversationId) {
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

    // Filter conversations by search term
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter((c) => {
            const title = c.type === 'channel' ? c.title : c.otherParticipant?.full_name;
            const email = c.otherParticipant?.email;
            const churchName = c.church?.name;
            const lastMsg = c.lastMessage?.content;
            return (
                (title && title.toLowerCase().includes(q)) ||
                (email && email.toLowerCase().includes(q)) ||
                (churchName && churchName.toLowerCase().includes(q)) ||
                (lastMsg && lastMsg.toLowerCase().includes(q))
            );
        });
    }, [conversations, searchQuery]);

    // Filter contacts in New Message modal
    const filteredContacts = useMemo(() => {
        let result = [...contacts];
        if (contactRoleFilter !== 'all') {
            result = result.filter((c) => (c.role || 'user') === contactRoleFilter);
        }
        if (contactSearch.trim()) {
            const q = contactSearch.toLowerCase();
            result = result.filter((c) => {
                const name = (c.full_name || '').toLowerCase();
                const email = (c.email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
            });
        }
        return result;
    }, [contacts, contactRoleFilter, contactSearch]);

    // Format role badge styling helper
    const getRoleBadge = (role?: string | null) => {
        switch (role) {
            case 'super_admin':
                return {
                    label: 'Super Admin',
                    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300',
                };
            case 'admin':
                return {
                    label: 'Diocese Admin',
                    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
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
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatConversationDate = (isoString?: string | null) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    // Total unread count across all conversations
    const totalUnreadCount = useMemo(() => {
        return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    }, [conversations]);

    const hasChurchAffiliation = Boolean(profile?.assigned_church_id || profile?.church_id);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-7xl mx-auto space-y-4">
            {/* Top Bar Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                                Real-Time Messaging
                            </h1>
                            {totalUnreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white animate-pulse">
                                    {totalUnreadCount} new
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted">
                            Connect with diocese clergy, parish staff, and parishioners instantly
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Quick Staff Channel Button */}
                    {hasChurchAffiliation && (
                        <button
                            type="button"
                            onClick={handleOpenChurchStaffChannel}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-secondary-100 hover:bg-secondary-200 text-secondary-800 border border-border transition-colors"
                        >
                            <Building2 className="w-4 h-4 text-primary" />
                            <span>Staff Channel</span>
                        </button>
                    )}

                    {/* New Chat Button */}
                    <button
                        type="button"
                        onClick={handleOpenNewChatModal}
                        className="btn-primary inline-flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-2 rounded-xl text-white font-semibold shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Message</span>
                    </button>
                </div>
            </div>

            {/* Main Dual-Pane Chat Card */}
            <div className="flex-1 min-h-0 card p-0 border border-border/80 rounded-2xl shadow-sm overflow-hidden flex bg-card">
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* LEFT PANE: CONVERSATION LIST                                   */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div
                    className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-background/50 flex-shrink-0 ${
                        mobileChatOpen ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {/* Search & Channel Header */}
                    <div className="p-3.5 border-b border-border space-y-2.5 bg-card">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input !pl-9 w-full text-xs py-2"
                            />
                        </div>

                        {hasChurchAffiliation && (
                            <button
                                type="button"
                                onClick={handleOpenChurchStaffChannel}
                                className="w-full flex items-center justify-between p-2 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-xs font-semibold text-primary transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                        <Building2 className="w-4 h-4" />
                                    </div>
                                    <span className="truncate">Parish Staff Channel</span>
                                </div>
                                <ChevronRight className="w-4 h-4 opacity-70" />
                            </button>
                        )}
                    </div>

                    {/* Conversation List Items */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                        {loadingConversations ? (
                            <div className="p-8 text-center space-y-2">
                                <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent mx-auto" />
                                <p className="text-xs text-muted">Loading chats...</p>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="p-8 text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-secondary-100 mx-auto flex items-center justify-center text-muted">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">No conversations yet</p>
                                    <p className="text-xs text-muted mt-0.5">
                                        Start a new conversation with parish staff or parishioners.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenNewChatModal}
                                    className="btn-primary text-white text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 mx-auto"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Start Chat
                                </button>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const isSelected = conv.id === activeConversationId;
                                const isChannel = conv.type === 'channel';
                                const displayName = isChannel
                                    ? conv.title || 'Parish Staff Channel'
                                    : conv.otherParticipant?.full_name || 'Direct Conversation';
                                const roleInfo = getRoleBadge(conv.otherParticipant?.role);
                                const lastMsg = conv.lastMessage;
                                const isCallInvite = lastMsg?.message_type === 'call_invite';

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => {
                                            setActiveConversationId(conv.id);
                                            setMobileChatOpen(true);
                                        }}
                                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-primary/10 border-l-4 border-primary dark:bg-primary/20'
                                                : 'hover:bg-secondary-50 dark:hover:bg-secondary-900/40'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            {isChannel ? (
                                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-sm">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                            ) : conv.otherParticipant?.avatar_url ? (
                                                <img
                                                    src={conv.otherParticipant.avatar_url}
                                                    alt={displayName}
                                                    className="w-11 h-11 rounded-xl object-cover"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shadow-sm">
                                                    {displayName.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <h3
                                                    className={`text-xs sm:text-sm font-semibold truncate ${
                                                        isSelected ? 'text-primary' : 'text-foreground'
                                                    }`}
                                                >
                                                    {displayName}
                                                </h3>
                                                <span className="text-[10px] text-muted flex-shrink-0">
                                                    {formatConversationDate(conv.updated_at)}
                                                </span>
                                            </div>

                                            {/* Role & Parish Tags */}
                                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                                {!isChannel && (
                                                    <span
                                                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${roleInfo.className}`}
                                                    >
                                                        {roleInfo.label}
                                                    </span>
                                                )}
                                                {conv.church?.name && (
                                                    <span className="text-[10px] text-muted truncate max-w-[140px]">
                                                        • {conv.church.name}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Last message preview */}
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted truncate">
                                                    {isCallInvite ? (
                                                        <span className="inline-flex items-center gap-1 text-primary font-medium">
                                                            <Video className="w-3 h-3 text-primary" />
                                                            Video Meeting Invited
                                                        </span>
                                                    ) : (
                                                        lastMsg?.content || 'No messages yet'
                                                    )}
                                                </p>

                                                {/* Unread Badge */}
                                                {conv.unreadCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white flex-shrink-0">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* RIGHT PANE: ACTIVE CHAT VIEWPORT                               */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div
                    className={`flex-1 flex flex-col bg-card min-w-0 ${
                        !mobileChatOpen ? 'hidden md:flex' : 'flex'
                    }`}
                >
                    {activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Mobile Back Button */}
                                    <button
                                        type="button"
                                        onClick={() => setMobileChatOpen(false)}
                                        className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-secondary-100"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>

                                    {/* Active Chat Avatar */}
                                    {activeConversation.type === 'channel' ? (
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                    ) : activeConversation.otherParticipant?.avatar_url ? (
                                        <img
                                            src={activeConversation.otherParticipant.avatar_url}
                                            alt={activeConversation.otherParticipant.full_name || ''}
                                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm flex-shrink-0">
                                            {(
                                                activeConversation.otherParticipant?.full_name || 'U'
                                            )
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    )}

                                    {/* Name and Meta */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                                                {activeConversation.type === 'channel'
                                                    ? activeConversation.title
                                                    : activeConversation.otherParticipant?.full_name ||
                                                      'Conversation'}
                                            </h2>
                                            {activeConversation.type !== 'channel' && (
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                                        getRoleBadge(
                                                            activeConversation.otherParticipant?.role
                                                        ).className
                                                    }`}
                                                >
                                                    {
                                                        getRoleBadge(
                                                            activeConversation.otherParticipant?.role
                                                        ).label
                                                    }
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted truncate">
                                            {activeConversation.type === 'channel'
                                                ? `${activeConversation.participants.length} staff participants`
                                                : activeConversation.church?.name ||
                                                  activeConversation.otherParticipant?.email ||
                                                  'Direct Chat'}
                                        </p>
                                    </div>
                                </div>

                                {/* Header Action: Instant Video Call Button */}
                                {(profile?.role === 'super_admin' ||
                                    profile?.role === 'admin' ||
                                    profile?.role === 'church_admin' ||
                                    profile?.role === 'priest' ||
                                    profile?.role === 'volunteer') && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleStartVideoCall(activeConversation)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                                            title="Start instant video/audio conference"
                                        >
                                            <Video className="w-4 h-4" />
                                            <span className="hidden sm:inline">Start Video Call</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Message Thread Scroll Viewport */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-secondary-50/40 dark:bg-background/40">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                                            <Sparkles className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-bold text-foreground">
                                                Start of your conversation
                                            </h4>
                                            <p className="text-xs text-muted max-w-sm mt-1">
                                                Send your first message or start an instant video call to begin
                                                coordinating.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isCurrentUser = msg.sender_id === user?.id;
                                        const isCallInvite = msg.message_type === 'call_invite';
                                        const meta = (msg.metadata as any) || {};

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-end gap-2.5 ${
                                                    isCurrentUser ? 'justify-end' : 'justify-start'
                                                }`}
                                            >
                                                {/* Left Avatar for other users */}
                                                {!isCurrentUser && (
                                                    <div className="w-8 h-8 rounded-lg bg-secondary-200 text-secondary-700 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                                                        {msg.sender?.avatar_url ? (
                                                            <img
                                                                src={msg.sender.avatar_url}
                                                                alt={msg.sender.full_name || ''}
                                                                className="w-8 h-8 rounded-lg object-cover"
                                                            />
                                                        ) : (
                                                            (msg.sender?.full_name || 'U')
                                                                .charAt(0)
                                                                .toUpperCase()
                                                        )}
                                                    </div>
                                                )}

                                                {/* Bubble Body */}
                                                <div
                                                    className={`max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl p-3.5 shadow-sm space-y-1.5 ${
                                                        isCurrentUser
                                                            ? 'bg-primary text-white rounded-br-none'
                                                            : 'bg-white dark:bg-card border border-border/80 text-foreground rounded-bl-none'
                                                    }`}
                                                >
                                                    {/* Sender info when in group or other user */}
                                                    {!isCurrentUser && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-bold text-foreground">
                                                                {msg.sender?.full_name || 'Staff Member'}
                                                            </span>
                                                            <span
                                                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                                                    getRoleBadge(msg.sender?.role).className
                                                                }`}
                                                            >
                                                                {getRoleBadge(msg.sender?.role).label}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* If Call Invite Card */}
                                                    {isCallInvite ? (
                                                        <div
                                                            className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                                                                isCurrentUser
                                                                    ? 'bg-white/10 border-white/20 text-white'
                                                                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-900 dark:text-emerald-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                                                                    <Video className="w-4 h-4" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold truncate">
                                                                        Parish Video Conference
                                                                    </p>
                                                                    <p
                                                                        className={`text-[11px] truncate ${
                                                                            isCurrentUser
                                                                                ? 'text-white/80'
                                                                                : 'text-emerald-700 dark:text-emerald-300'
                                                                        }`}
                                                                    >
                                                                        Room: {meta.roomName || 'Active Room'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleJoinCall(
                                                                        meta.roomName || 'sacralink-meeting',
                                                                        meta.meetingTitle
                                                                    )
                                                                }
                                                                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                                                            >
                                                                <Video className="w-4 h-4" />
                                                                <span>Join Video Conference</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        /* Normal Message Text */
                                                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                                                            {msg.content}
                                                        </p>
                                                    )}

                                                    {/* Timestamp and Read check */}
                                                    <div
                                                        className={`flex items-center justify-end gap-1 text-[10px] ${
                                                            isCurrentUser
                                                                ? 'text-white/70'
                                                                : 'text-muted'
                                                        }`}
                                                    >
                                                        <span>{formatMessageTime(msg.created_at)}</span>
                                                        {isCurrentUser && (
                                                            <CheckCheck className="w-3 h-3 text-white/80" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Composer Footer */}
                            <div className="p-3 sm:p-4 border-t border-border bg-card">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }}
                                    className="flex items-end gap-2"
                                >
                                    <div className="flex-1 relative">
                                        <textarea
                                            ref={inputRef}
                                            rows={1}
                                            value={inputContent}
                                            onChange={(e) => setInputContent(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                                            className="input w-full resize-none py-2.5 text-xs sm:text-sm max-h-32 rounded-xl pr-10"
                                        />
                                    </div>

                                    {/* Video Call Quick Launch */}
                                    <button
                                        type="button"
                                        onClick={() => handleStartVideoCall(activeConversation)}
                                        className="p-2.5 rounded-xl border border-border text-muted hover:text-foreground hover:bg-secondary-100 transition-colors"
                                        title="Start Video Meeting"
                                    >
                                        <Video className="w-5 h-5 text-emerald-600" />
                                    </button>

                                    {/* Send Button */}
                                    <button
                                        type="submit"
                                        disabled={!inputContent.trim() || sending}
                                        className="btn-primary text-white p-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
                                        title="Send Message"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        /* Empty State when no conversation selected */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <div className="max-w-md">
                                <h3 className="text-lg font-bold text-foreground">
                                    No Conversation Selected
                                </h3>
                                <p className="text-xs sm:text-sm text-muted mt-1">
                                    Select an existing conversation from the list or initiate a new direct
                                    message with parish administrators, priests, volunteers, or parishioners.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenNewChatModal}
                                className="btn-primary text-white text-xs sm:text-sm px-4 py-2 rounded-xl font-semibold inline-flex items-center gap-2 shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Start a Conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* NEW CONVERSATION MODAL                                          */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <Modal
                isOpen={showNewChatModal}
                onClose={() => setShowNewChatModal(false)}
                title="New Direct Conversation"
                description="Search parish clergy, administrators, staff, or parishioners to start chatting"
                size="lg"
            >
                <div className="space-y-4">
                    {/* Search & Filter */}
                    <div className="space-y-2.5">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={contactSearch}
                                onChange={(e) => setContactSearch(e.target.value)}
                                className="input !pl-10 w-full text-xs sm:text-sm"
                            />
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                            {[
                                { id: 'all', label: 'All Contacts' },
                                { id: 'priest', label: 'Priests' },
                                { id: 'church_admin', label: 'Church Admins' },
                                { id: 'volunteer', label: 'Volunteers' },
                                { id: 'user', label: 'Parishioners' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setContactRoleFilter(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                                        contactRoleFilter === tab.id
                                            ? 'bg-primary text-white'
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
                                <p className="text-xs text-muted">Loading directory...</p>
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted">
                                No contacts found matching your search.
                            </div>
                        ) : (
                            filteredContacts.map((c) => {
                                const role = getRoleBadge(c.role);
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
                                                    className="w-9 h-9 rounded-xl object-cover"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                                    {(c.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                                    {c.full_name || 'No name'}
                                                </p>
                                                <p className="text-[11px] text-muted truncate">{c.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${role.className}`}
                                            >
                                                {role.label}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-muted" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

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
