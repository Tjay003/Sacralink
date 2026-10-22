import { supabase } from '../supabase';
import type { Conversation, ConversationParticipant, Message, Profile, Church } from '../../types/database';

export interface ParticipantWithProfile extends ConversationParticipant {
    profile?: Profile | null;
}

export interface MessageWithSender extends Message {
    sender?: Profile | null;
}

export interface MinistryDefinition {
    id: string;
    name: string;
    description: string;
    category: 'liturgy' | 'youth' | 'pastoral' | 'music' | 'service';
    iconName: string;
}

export const PARISH_MINISTRIES: MinistryDefinition[] = [
    {
        id: 'parish-youth-ministry',
        name: 'Parish Youth Ministry',
        description: 'Empowering young Catholics through spiritual growth, fellowship, youth camps, and vibrant community service.',
        category: 'youth',
        iconName: 'Users',
    },
    {
        id: 'lectors-commentators',
        name: 'Lectors & Commentators Ministry',
        description: 'Proclaiming the Word of God with reverence and directing parish liturgical assemblies with clarity.',
        category: 'liturgy',
        iconName: 'BookOpen',
    },
    {
        id: 'liturgical-music-choir',
        name: 'Liturgical Music & Choir',
        description: 'Leading the congregation in uplifting sacred hymns, psalms, and liturgical worship to glorify God.',
        category: 'music',
        iconName: 'Music',
    },
    {
        id: 'parish-pastoral-council',
        name: 'Parish Pastoral Council',
        description: 'Advising the parish priest and coordinating pastoral initiatives, community programs, and apostolic works.',
        category: 'pastoral',
        iconName: 'Compass',
    },
    {
        id: 'altar-servers-ministry',
        name: 'Altar Servers Ministry',
        description: 'Assisting clergy at the sacred altar during Holy Mass, devotions, and liturgical solemnities.',
        category: 'liturgy',
        iconName: 'Flame',
    },
    {
        id: 'extraordinary-ministers-communion',
        name: 'Extraordinary Ministers of Holy Communion',
        description: 'Assisting in the reverent distribution of the Holy Eucharist during Mass and bringing Communion to the sick.',
        category: 'liturgy',
        iconName: 'Heart',
    },
    {
        id: 'caritas-social-action',
        name: 'Social Action & Caritas Ministry',
        description: 'Spearheading parish charity outreach, feeding programs, emergency disaster relief, and medical missions.',
        category: 'service',
        iconName: 'HandHeart',
    },
    {
        id: 'catechetical-ministry',
        name: 'Catechetical & Faith Formation',
        description: 'Teaching Sunday school, preparing catechumens for Holy Sacraments, and fostering adult faith deepening.',
        category: 'pastoral',
        iconName: 'GraduationCap',
    },
];

export interface ChurchMinistryChannelItem {
    id: string;
    ministryId: string;
    conversationId: string | null;
    name: string;
    title: string;
    description: string;
    category: 'liturgy' | 'youth' | 'pastoral' | 'music' | 'service';
    iconName: string;
    isJoined: boolean;
    participantCount: number;
    conversation?: ConversationWithDetails | null;
    lastMessage?: MessageWithSender | null;
    unreadCount?: number;
}

export interface ConversationWithDetails extends Conversation {
    participants: ParticipantWithProfile[];
    lastMessage?: MessageWithSender | null;
    unreadCount: number;
    church?: Church | null;
    otherParticipant?: Profile | null; // For 1-on-1 direct chats
    ministry?: MinistryDefinition | null; // For ministry group channels
    category?: string | null;
    status?: string | null;
    ticket_number?: string | null;
}

export interface ContactProfile extends Profile {
    assigned_church?: { id: string; name: string } | null;
    church?: { id: string; name: string } | null;
}

/** Fired on window after a conversation is marked read, so the sidebar unread badge can refresh. */
export const UNREAD_CHANGED_EVENT = 'sacralink:unread_changed';

/** Volunteers may only start Direct Messages with church admins and volunteers of their own parish. */
function isVolunteerAllowedContact(
    me: { church_id?: string | null; assigned_church_id?: string | null },
    target: { role?: string | null; is_priest?: boolean | null; church_id?: string | null; assigned_church_id?: string | null }
): boolean {
    if (!['church_admin', 'volunteer'].includes(target.role || '') || target.is_priest) return false;
    const myChurches = [me.church_id, me.assigned_church_id].filter(Boolean);
    return [target.church_id, target.assigned_church_id].some((id) => id && myChurches.includes(id));
}

// ============================================================================
// OFFLINE & DEMO FALLBACK STORAGE HELPERS
// ============================================================================
const LOCAL_MINISTRY_STORAGE_KEY = 'sacralink_local_ministry_convs';
const LOCAL_MINISTRY_MESSAGES_KEY = 'sacralink_local_ministry_messages';

// The browser fallback cache is partitioned by the signed-in user's id so that
// switching accounts in the same browser never merges another user's cached chats.
let localMessagingOwnerId: string | null = null;

/**
 * Declare which authenticated user owns the local fallback cache.
 * Called by the auth layer whenever the signed-in user changes.
 */
export function setLocalMessagingOwner(userId: string | null): void {
    localMessagingOwnerId = userId;
}

/**
 * Remove every local ministry conversation/message cache key (for any user)
 * from localStorage and sessionStorage. Called on sign-out.
 */
export function clearLocalMessagingCache(): void {
    if (typeof window === 'undefined') return;
    for (const store of [window.localStorage, window.sessionStorage]) {
        try {
            if (!store) continue;
            const doomed: string[] = [];
            for (let i = 0; i < store.length; i++) {
                const key = store.key(i);
                if (
                    key &&
                    (key.startsWith(LOCAL_MINISTRY_STORAGE_KEY) || key.startsWith(LOCAL_MINISTRY_MESSAGES_KEY))
                ) {
                    doomed.push(key);
                }
            }
            doomed.forEach((key) => store.removeItem(key));
        } catch (e) {
            console.warn('Could not clear local messaging cache:', e);
        }
    }
}

function localConvsKey(): string | null {
    return localMessagingOwnerId ? `${LOCAL_MINISTRY_STORAGE_KEY}:${localMessagingOwnerId}` : null;
}

function localMessagesKey(conversationId: string): string | null {
    return localMessagingOwnerId
        ? `${LOCAL_MINISTRY_MESSAGES_KEY}:${localMessagingOwnerId}_${conversationId}`
        : null;
}

export interface LocalMinistryConv {
    id: string;
    title: string;
    type: string;
    church_id: string;
    church_name?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    participants: string[];
    category?: string | null;
    status?: string | null;
    ticket_number?: string | null;
}

export function isLocalConversation(conversationId: string): boolean {
    if (!conversationId) return false;
    return (
        conversationId.startsWith('ministry-') ||
        conversationId.startsWith('inquiry-') ||
        conversationId.startsWith('local-')
    );
}

export function getLocalMinistryConvs(churchId?: string): LocalMinistryConv[] {
    if (typeof window === 'undefined') return [];
    const storageKey = localConvsKey();
    if (!storageKey) return [];
    try {
        const raw = (window.localStorage && window.localStorage.getItem(storageKey)) ||
            (window.sessionStorage && window.sessionStorage.getItem(storageKey));
        const list: LocalMinistryConv[] = raw ? JSON.parse(raw) : [];
        if (churchId) {
            return list.filter((c) => c.church_id === churchId);
        }
        return list;
    } catch {
        return [];
    }
}

export function getLocalConversationById(conversationId: string): LocalMinistryConv | null {
    const list = getLocalMinistryConvs();
    return list.find((c) => c.id === conversationId) || null;
}

export function saveLocalMinistryConv(conv: LocalMinistryConv): void {
    if (typeof window === 'undefined') return;
    const storageKey = localConvsKey();
    if (!storageKey) return;
    try {
        const list = getLocalMinistryConvs();
        const existingIdx = list.findIndex(
            (c) => c.id === conv.id || (c.church_id === conv.church_id && c.title === conv.title)
        );
        if (existingIdx >= 0) {
            const existing = list[existingIdx];
            const mergedParticipants = Array.from(new Set([...existing.participants, ...conv.participants]));
            list[existingIdx] = { 
                ...existing, 
                ...conv, 
                church_name: conv.church_name || existing.church_name,
                participants: mergedParticipants 
            };
        } else {
            list.push(conv);
        }
        if (window.localStorage) {
            window.localStorage.setItem(storageKey, JSON.stringify(list));
        }
        if (window.sessionStorage) {
            window.sessionStorage.setItem(storageKey, JSON.stringify(list));
        }
    } catch (e) {
        console.warn('Could not save local ministry conv:', e);
    }
}

export function getLocalMinistryMessages(conversationId: string): MessageWithSender[] {
    if (typeof window === 'undefined') return [];
    const key = localMessagesKey(conversationId);
    if (!key) return [];
    try {
        const raw = (window.localStorage && window.localStorage.getItem(key)) ||
            (window.sessionStorage && window.sessionStorage.getItem(key));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalMinistryMessage(msg: MessageWithSender): void {
    if (typeof window === 'undefined') return;
    const key = localMessagesKey(msg.conversation_id);
    if (!key) return;
    try {
        const list = getLocalMinistryMessages(msg.conversation_id);
        if (!list.some((m) => m.id === msg.id)) {
            list.push(msg);
            if (window.localStorage) {
                window.localStorage.setItem(key, JSON.stringify(list));
            }
            if (window.sessionStorage) {
                window.sessionStorage.setItem(key, JSON.stringify(list));
            }
        }
    } catch (e) {
        console.warn('Could not save local ministry message:', e);
    }
}

function notifyLocalMessage(msg: MessageWithSender): void {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new CustomEvent('sacralink:local_message', { detail: msg }));
    } catch (e) {
        console.warn('Could not dispatch local message event:', e);
    }
}


/**
 * Fetch all conversations for a given user with participant details and latest message
 */
export async function fetchUserConversations(userId: string): Promise<{
    data: ConversationWithDetails[] | null;
    error: Error | null;
}> {
    try {
        let enrichedConversations: ConversationWithDetails[] = [];

        // 0. Query profile of current user to know their role and assigned church
        const { data: myProfile } = await supabase
            .from('profiles')
            .select('role, assigned_church_id, church_id')
            .eq('id', userId)
            .maybeSingle();

        const staffChurchId = myProfile?.assigned_church_id || myProfile?.church_id || null;
        const isStaffOrClergy = ['super_admin', 'admin', 'church_admin', 'priest', 'volunteer'].includes(myProfile?.role || '');

        // 1. Get all conversation IDs that user is participant in from Supabase
        const { data: participantRows, error: participantError } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('user_id', userId);

        if (participantError) {
            console.warn('⚠️ [Messaging] Could not fetch Supabase participants:', participantError);
        }

        const conversationIds = (participantRows || []).map((p) => p.conversation_id);
        const lastReadMap = new Map<string, string | null>();
        (participantRows || []).forEach((p) => {
            lastReadMap.set(p.conversation_id, p.last_read_at);
        });

        // 2. Fetch conversation rows with associated church
        // If user is staff/clergy, query conversations where they are a participant AND
        // conversations belonging to their assigned church with type in ('channel', 'group')
        let conversations: any[] | null = null;
        let convError: any = null;

        if (isStaffOrClergy && staffChurchId) {
            const queryPromises: Promise<any>[] = [];

            // Query A: Conversations where user is an explicit participant
            if (conversationIds.length > 0) {
                queryPromises.push(
                    Promise.resolve(
                        supabase
                            .from('conversations')
                            .select('*, church:churches(*)')
                            .in('id', conversationIds)
                    )
                );
            }

            // Query B: Church-wide channels and group tickets/inquiries belonging to their assigned church
            queryPromises.push(
                Promise.resolve(
                    supabase
                        .from('conversations')
                        .select('*, church:churches(*)')
                        .eq('church_id', staffChurchId)
                        .in('type', ['channel', 'group'])
                )
            );

            const results = await Promise.all(queryPromises);
            const combinedMap = new Map<string, any>();

            results.forEach((res) => {
                if (res.error) {
                    convError = res.error;
                }
                (res.data || []).forEach((c: any) => {
                    combinedMap.set(c.id, c);
                });
            });

            conversations = Array.from(combinedMap.values());
        } else if (conversationIds.length > 0) {
            const res = await supabase
                .from('conversations')
                .select('*, church:churches(*)')
                .in('id', conversationIds)
                .order('updated_at', { ascending: false });
            conversations = res.data;
            convError = res.error;
        }

        if (convError) {
            console.warn('⚠️ [Messaging] Could not fetch Supabase conversations:', convError);
        }

        if (conversations && conversations.length > 0) {
            const fetchedConvIds = conversations.map((c: any) => c.id);

            // 3. Fetch all participants for these conversations
            const { data: allParticipants, error: allPartError } = await supabase
                .from('conversation_participants')
                .select('*')
                .in('conversation_id', fetchedConvIds);

            if (allPartError) {
                console.warn('⚠️ [Messaging] Could not fetch Supabase participant details:', allPartError);
            }

            // 3b. Fetch profiles for all participant user_ids
            const participantUserIds = Array.from(new Set((allParticipants || []).map((p: any) => p.user_id).filter(Boolean)));
            const profileMap = new Map<string, Profile>();
            if (participantUserIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', participantUserIds);
                (profilesData || []).forEach((prof: any) => {
                    profileMap.set(prof.id, prof);
                });
            }

            // Group participants by conversation_id
            const participantsByConv = new Map<string, ParticipantWithProfile[]>();
            (allParticipants || []).forEach((part: any) => {
                const list = participantsByConv.get(part.conversation_id) || [];
                list.push({
                    ...part,
                    profile: profileMap.get(part.user_id) || null,
                });
                participantsByConv.set(part.conversation_id, list);
            });

            // 4. Fetch the latest messages for each conversation and compute unread counts
            // Ensure profiles of all message senders are properly joined so msg.sender details are present
            enrichedConversations = await Promise.all(
                conversations.map(async (conv: any) => {
                    const parts = participantsByConv.get(conv.id) || [];
                    const userLastRead = lastReadMap.get(conv.id);

                    // Fetch latest message joined with sender profile
                    const { data: latestMessages } = await supabase
                        .from('messages')
                        .select('*, sender:profiles(*)')
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    let lastMsg: MessageWithSender | null = null;
                    if (latestMessages && latestMessages.length > 0) {
                        const rawMsg = latestMessages[0] as any;
                        let senderProfile = rawMsg.sender || profileMap.get(rawMsg.sender_id) || null;
                        if (!senderProfile && rawMsg.sender_id) {
                            const { data: singleSender } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', rawMsg.sender_id)
                                .maybeSingle();
                            if (singleSender) {
                                senderProfile = singleSender;
                                profileMap.set(rawMsg.sender_id, singleSender);
                            }
                        }
                        lastMsg = {
                            ...rawMsg,
                            sender: senderProfile,
                        };
                    }

                    // Count unread messages (newer than last_read_at and not sent by current user)
                    let unreadCount = 0;
                    if (userLastRead) {
                        const { count } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('conversation_id', conv.id)
                            .neq('sender_id', userId)
                            .gt('created_at', userLastRead);
                        unreadCount = count || 0;
                    } else {
                        const { count } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('conversation_id', conv.id)
                            .neq('sender_id', userId);
                        unreadCount = count || 0;
                    }

                    // Determine other participant for 1-on-1 chats
                    const otherPart = parts.find((p) => p.user_id !== userId)?.profile || null;
                    const ministryDef = conv.type === 'group'
                        ? PARISH_MINISTRIES.find((m) => m.name === conv.title) || null
                        : null;

                    // Only assign ticket category/status if conversation has a ticket number or is an inquiry
                    const isTicket = Boolean(conv.ticket_number);

                    return {
                        ...conv,
                        category: isTicket ? (conv.category || 'general') : (conv.category || null),
                        status: isTicket ? (conv.status || 'open') : (conv.status || null),
                        ticket_number: conv.ticket_number || null,
                        participants: parts,
                        lastMessage: lastMsg,
                        unreadCount,
                        church: conv.church || null,
                        otherParticipant: otherPart,
                        ministry: ministryDef,
                    };
                })
            );
        }

        // Merge any local fallback conversations (ministries & parish inquiries) the user is part of
        // or belongs to the staff member's assigned church
        const localConvs = getLocalMinistryConvs();
        const userLocalConvs = localConvs.filter((lc) => {
            const isParticipantOrCreator = lc.participants.includes(userId) || lc.created_by === userId;
            const isAssignedStaff = isStaffOrClergy && staffChurchId && lc.church_id === staffChurchId;
            return isParticipantOrCreator || isAssignedStaff;
        });
        userLocalConvs.forEach((lc) => {
            if (!enrichedConversations.some((c) => c.id === lc.id)) {
                const localMsgs = getLocalMinistryMessages(lc.id);
                const lastMsg = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
                const churchObj: Church | null = lc.church_id
                    ? ({
                          id: lc.church_id,
                          name: lc.church_name || 'Parish Office',
                      } as unknown as Church)
                    : null;

                const isTicket = Boolean(lc.ticket_number);

                enrichedConversations.push({
                    id: lc.id,
                    title: lc.title,
                    type: lc.type as any,
                    church_id: lc.church_id,
                    created_by: lc.created_by,
                    created_at: lc.created_at,
                    updated_at: lc.updated_at,
                    category: isTicket ? (lc.category || 'general') : (lc.category || null),
                    status: isTicket ? (lc.status || 'open') : (lc.status || null),
                    ticket_number: lc.ticket_number || null,
                    participants: lc.participants.map((pid) => ({
                        id: `part-${pid}`,
                        conversation_id: lc.id,
                        user_id: pid,
                        created_at: lc.created_at,
                        last_read_at: lc.updated_at,
                        profile: null,
                    })),
                    lastMessage: lastMsg,
                    unreadCount: 0,
                    church: churchObj,
                    otherParticipant: null,
                    ministry: PARISH_MINISTRIES.find((m) => m.name === lc.title) || null,
                });
            }
        });

        // Sort by updated_at descending
        enrichedConversations.sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        return { data: enrichedConversations, error: null };
    } catch (err: any) {
        console.error('❌ Error fetching user conversations:', err);
        // Robust fallback: return user's local conversations if any exist
        const localConvs = getLocalMinistryConvs();
        const userLocalConvs = localConvs.filter(
            (lc) => lc.participants.includes(userId) || lc.created_by === userId
        );
        if (userLocalConvs.length > 0) {
            const fallbackList: ConversationWithDetails[] = userLocalConvs.map((lc) => {
                const localMsgs = getLocalMinistryMessages(lc.id);
                const lastMsg = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
                const churchObj: Church | null = lc.church_id
                    ? ({
                          id: lc.church_id,
                          name: lc.church_name || 'Parish Office',
                      } as unknown as Church)
                    : null;

                return {
                    id: lc.id,
                    title: lc.title,
                    type: lc.type as any,
                    church_id: lc.church_id,
                    created_by: lc.created_by,
                    created_at: lc.created_at,
                    updated_at: lc.updated_at,
                    category: lc.category || 'general',
                    status: lc.status || 'open',
                    ticket_number: lc.ticket_number || null,
                    participants: lc.participants.map((pid) => ({
                        id: `part-${pid}`,
                        conversation_id: lc.id,
                        user_id: pid,
                        created_at: lc.created_at,
                        last_read_at: lc.updated_at,
                        profile: null,
                    })),
                    lastMessage: lastMsg,
                    unreadCount: 0,
                    church: churchObj,
                    otherParticipant: null,
                    ministry: PARISH_MINISTRIES.find((m) => m.name === lc.title) || null,
                };
            });
            return { data: fallbackList, error: null };
        }
        return { data: null, error: err };
    }
}

/**
 * Fetch message history for a conversation, ordered chronologically
 */
export async function fetchMessages(conversationId: string): Promise<{
    data: MessageWithSender[] | null;
    error: Error | null;
}> {
    try {
        if (isLocalConversation(conversationId)) {
            const localMsgs = getLocalMinistryMessages(conversationId);
            return { data: localMsgs, error: null };
        }

        const { data: rawMessages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!rawMessages || rawMessages.length === 0) {
            const localMsgs = getLocalMinistryMessages(conversationId);
            return { data: localMsgs, error: null };
        }

        const senderIds = Array.from(new Set(rawMessages.map((m: any) => m.sender_id).filter(Boolean)));
        const profileMap = new Map<string, Profile>();
        if (senderIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', senderIds);
            (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
        }

        const enrichedMessages: MessageWithSender[] = rawMessages.map((m: any) => ({
            ...m,
            sender: profileMap.get(m.sender_id) || null,
        }));

        // Merge any local messages for this conversation if present
        const localMsgs = getLocalMinistryMessages(conversationId);
        localMsgs.forEach((lm) => {
            if (!enrichedMessages.some((em) => em.id === lm.id)) {
                enrichedMessages.push(lm);
            }
        });
        enrichedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        return { data: enrichedMessages, error: null };
    } catch (err: any) {
        console.warn('❌ Error fetching messages, attempting local fallback:', err);
        const localMsgs = getLocalMinistryMessages(conversationId);
        return { data: localMsgs, error: null };
    }
}

/**
 * Send a message within a conversation
 */
export async function sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'call_invite' | 'system' = 'text',
    metadata: Record<string, unknown> = {}
): Promise<{
    data: MessageWithSender | null;
    error: Error | null;
}> {
    const now = new Date().toISOString();
    try {
        if (isLocalConversation(conversationId)) {
            const { data: senderProf } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', senderId)
                .maybeSingle();

            const localMsg: MessageWithSender = {
                id: `local-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                conversation_id: conversationId,
                sender_id: senderId,
                content: content.trim(),
                message_type: messageType,
                metadata: metadata as any,
                created_at: now,
                sender: (senderProf as Profile | null) || null,
            };

            saveLocalMinistryMessage(localMsg);
            notifyLocalMessage(localMsg);

            // Also update local conversation updated_at
            const localConvs = getLocalMinistryConvs();
            const conv = localConvs.find((c) => c.id === conversationId);
            if (conv) {
                conv.updated_at = now;
                saveLocalMinistryConv(conv);
            }

            return { data: localMsg, error: null };
        }

        const { data, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: senderId,
                content: content.trim(),
                message_type: messageType,
                metadata: metadata as any,
                created_at: now,
            } as any)
            .select('*, sender:profiles(*)')
            .single();

        if (error) throw error;

        // Also update conversation updated_at and sender's last_read_at
        await Promise.all([
            supabase
                .from('conversations')
                .update({ updated_at: now })
                .eq('id', conversationId),
            supabase
                .from('conversation_participants')
                .update({ last_read_at: now })
                .match({ conversation_id: conversationId, user_id: senderId }),
        ]);

        return { data: data as any, error: null };
    } catch (err: any) {
        console.warn('❌ Error sending message, using local fallback:', err);
        const { data: senderProf } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', senderId)
            .maybeSingle();

        const localMsg: MessageWithSender = {
            id: `local-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversation_id: conversationId,
            sender_id: senderId,
            content: content.trim(),
            message_type: messageType,
            metadata: metadata as any,
            created_at: now,
            sender: (senderProf as Profile | null) || null,
        };

        saveLocalMinistryMessage(localMsg);
        notifyLocalMessage(localMsg);

        // Also update local conversation updated_at
        const localConvs = getLocalMinistryConvs();
        const conv = localConvs.find((c) => c.id === conversationId);
        if (conv) {
            conv.updated_at = now;
            saveLocalMinistryConv(conv);
        }

        return { data: localMsg, error: null };
    }
}

/**
 * Get or create a 1-on-1 direct conversation between two users
 */
export async function getOrCreateDirectConversation(
    userId: string,
    targetUserId: string
): Promise<{
    conversationId: string | null;
    error: Error | null;
}> {
    try {
        if (!userId || !targetUserId) {
            throw new Error('Both userId and targetUserId are required to start a direct conversation');
        }
        if (userId === targetUserId) {
            throw new Error('Cannot create direct conversation with oneself');
        }

        console.log(`[Messaging] Checking direct conversation between ${userId} and ${targetUserId}...`);

        // Office Gateway validation:
        const [callerProfileRes, targetProfileRes] = await Promise.all([
            supabase.from('profiles').select('id, role, is_priest, church_id, assigned_church_id').eq('id', userId).maybeSingle(),
            supabase.from('profiles').select('id, role, is_priest, church_id, assigned_church_id').eq('id', targetUserId).maybeSingle(),
        ]);

        const callerRole = callerProfileRes.data?.role || 'user';
        const targetRole = targetProfileRes.data?.role || 'user';
        const isTargetPriest = targetRole === 'priest' || targetProfileRes.data?.is_priest === true;
        const isCallerPriest = callerRole === 'priest' || callerProfileRes.data?.is_priest === true;

        if (callerRole === 'user' && isTargetPriest) {
            throw new Error('Parishioners cannot initiate direct conversations with clergy. Please message the Parish Office instead.');
        }

        if (callerRole === 'user' && !['super_admin', 'admin', 'church_admin'].includes(targetRole)) {
            throw new Error('Parishioners can only initiate direct conversations with Parish Office and Admin staff.');
        }

        if (
            callerRole === 'volunteer' &&
            (!callerProfileRes.data ||
                !targetProfileRes.data ||
                !isVolunteerAllowedContact(callerProfileRes.data, targetProfileRes.data))
        ) {
            throw new Error('Volunteers can only start direct messages with the church admins and volunteers of their own parish.');
        }

        if (isCallerPriest && targetRole === 'user') {
            const { data: appts, error: apptErr } = await supabase
                .from('appointments')
                .select('id')
                .eq('priest_id', userId)
                .eq('user_id', targetUserId)
                .limit(1);

            if (apptErr) throw apptErr;

            if (!appts || appts.length === 0) {
                throw new Error('Priests can only initiate direct messages with parishioners who have an appointment assigned to them.');
            }
        }

        // 1. Find all conversations userId is in
        const { data: userConvs, error: partError } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userId);

        if (partError) {
            console.error('❌ [Messaging] Error fetching user participants:', partError);
            throw partError;
        }

        const candidateIds = (userConvs || []).map((c) => c.conversation_id);

        if (candidateIds.length > 0) {
            // Find direct conversations among candidateIds
            const { data: directConvs, error: convError } = await supabase
                .from('conversations')
                .select('id, type')
                .in('id', candidateIds)
                .eq('type', 'direct');

            if (convError) {
                console.error('❌ [Messaging] Error fetching candidate direct conversations:', convError);
                throw convError;
            }

            const directIds = (directConvs || []).map((c) => c.id);

            if (directIds.length > 0) {
                // Check which of these has targetUserId as a participant
                const { data: matchingParticipants, error: matchError } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .in('conversation_id', directIds)
                    .eq('user_id', targetUserId)
                    .limit(1);

                if (matchError) {
                    console.error('❌ [Messaging] Error checking target participant:', matchError);
                    throw matchError;
                }

                if (matchingParticipants && matchingParticipants.length > 0) {
                    console.log(`[Messaging] Existing conversation found: ${matchingParticipants[0].conversation_id}`);
                    return { conversationId: matchingParticipants[0].conversation_id, error: null };
                }
            }
        }

        // 2. No existing conversation found -> Create new direct conversation
        console.log('[Messaging] Creating new direct conversation...');
        const { data: newConv, error: createConvError } = await supabase
            .from('conversations')
            .insert({
                type: 'direct',
                created_by: userId,
                title: null,
            } as any)
            .select('id')
            .single();

        if (createConvError) {
            console.error('❌ [Messaging] Error creating conversation:', createConvError);
            throw createConvError;
        }

        if (!newConv?.id) {
            throw new Error('Failed to create direct conversation: No conversation ID returned.');
        }

        const newId = newConv.id;
        console.log(`[Messaging] Created conversation ${newId}. Adding participants...`);

        // 3. Add both users as participants
        const { error: addPartsError } = await supabase
            .from('conversation_participants')
            .insert([
                { conversation_id: newId, user_id: userId },
                { conversation_id: newId, user_id: targetUserId },
            ] as any);

        if (addPartsError) {
            console.error('❌ [Messaging] Error adding participants to conversation:', addPartsError);
            // Attempt cleanup to prevent orphaned conversations
            try {
                await supabase.from('conversations').delete().eq('id', newId);
            } catch (cleanupErr: any) {
                console.warn('[Messaging] Could not clean up orphaned conversation:', cleanupErr);
            }
            throw addPartsError;
        }

        console.log(`✅ [Messaging] Direct conversation created successfully: ${newId}`);
        return { conversationId: newId, error: null };
    } catch (err: any) {
        console.error('❌ Error getting/creating direct conversation:', err);
        return { conversationId: null, error: err };
    }
}

/**
 * Get or create a Parish Staff group channel for a specific church
 */
export async function getOrCreateChurchStaffChannel(
    churchId: string,
    userId: string,
    churchName?: string
): Promise<{
    conversationId: string | null;
    error: Error | null;
}> {
    try {
        // 1. Look for existing channel conversation for this church
        const { data: existingConvs, error: findError } = await supabase
            .from('conversations')
            .select('id')
            .eq('church_id', churchId)
            .eq('type', 'channel')
            .limit(1);

        if (findError) throw findError;

        if (existingConvs && existingConvs.length > 0) {
            const channelId = existingConvs[0].id;

            // Ensure current user is listed in conversation_participants
            const { data: partExists } = await supabase
                .from('conversation_participants')
                .select('id')
                .eq('conversation_id', channelId)
                .eq('user_id', userId)
                .maybeSingle();

            if (!partExists) {
                await supabase
                    .from('conversation_participants')
                    .insert({ conversation_id: channelId, user_id: userId } as any);
            }

            return { conversationId: channelId, error: null };
        }

        // 2. Fetch church name if not provided
        let resolvedChurchName = churchName;
        if (!resolvedChurchName) {
            const { data: churchData } = await supabase
                .from('churches')
                .select('name')
                .eq('id', churchId)
                .single();
            resolvedChurchName = churchData?.name || 'Parish';
        }

        // 3. Create new channel conversation
        const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
                title: `${resolvedChurchName} Staff Channel`,
                type: 'channel',
                church_id: churchId,
                created_by: userId,
            } as any)
            .select('id')
            .single();

        if (createError) throw createError;

        const newChannelId = newConv.id;

        // 4. Find all church staff (admin, church_admin, volunteer, priest) to automatically add
        // Only genuine parish staff roles: parishioners (role = 'user') are never enrolled.
        const staffRoles: Profile['role'][] = ['church_admin', 'priest', 'volunteer'];
        const [churchStaff1, churchStaff2] = await Promise.all([
            supabase
                .from('profiles')
                .select('id')
                .in('role', staffRoles)
                .eq('church_id', churchId),
            supabase
                .from('profiles')
                .select('id')
                .in('role', staffRoles)
                .eq('assigned_church_id', churchId),
        ]);

        const staffIds = new Set<string>([userId]);
        (churchStaff1.data || []).forEach((p) => staffIds.add(p.id));
        (churchStaff2.data || []).forEach((p) => staffIds.add(p.id));

        const participantInserts = Array.from(staffIds).map((uid) => ({
            conversation_id: newChannelId,
            user_id: uid,
        }));

        if (participantInserts.length > 0) {
            await supabase
                .from('conversation_participants')
                .insert(participantInserts as any);
        }

        return { conversationId: newChannelId, error: null };
    } catch (err: any) {
        console.error('❌ Error getting/creating church staff channel:', err);
        return { conversationId: null, error: err };
    }
}

/**
 * Get or create a Parish Ministry Group Channel for a specific church
 * Parishioners and staff can participate in verified Parish Ministry Channels.
 * Checks if a conversation with type = 'group' and church_id = churchId and title = ministryName already exists.
 * If it exists, ensures userId is added as a participant in conversation_participants.
 * If not, creates the conversation and adds the creator as participant.
 * Includes robust fallback if Supabase returns errors or in demo/offline mode.
 */
export async function getOrCreateMinistryChannel(
    churchId: string,
    ministryId: string,
    ministryName: string,
    userId: string
): Promise<{
    conversationId: string | null;
    error: Error | null;
}> {
    try {
        if (!churchId || !userId) {
            throw new Error('Church ID and User ID are required to join or create a ministry channel');
        }

        console.log(`[Messaging] Checking ministry channel "${ministryName}" for church ${churchId}...`);

        // 1. Look for existing conversation with type = 'group', church_id = churchId, and title = ministryName
        const { data: existingConvs, error: findError } = await supabase
            .from('conversations')
            .select('id, title, type, church_id')
            .eq('church_id', churchId)
            .eq('type', 'group')
            .eq('title', ministryName)
            .limit(1);

        if (!findError && existingConvs && existingConvs.length > 0) {
            const channelId = existingConvs[0].id;
            console.log(`[Messaging] Existing ministry channel found in Supabase: ${channelId}`);

            // Ensure current user is in conversation_participants
            const { data: partExists } = await supabase
                .from('conversation_participants')
                .select('id')
                .eq('conversation_id', channelId)
                .eq('user_id', userId)
                .maybeSingle();

            if (!partExists) {
                await supabase
                    .from('conversation_participants')
                    .insert({ conversation_id: channelId, user_id: userId } as any);
            }

            // Keep local fallback in sync
            saveLocalMinistryConv({
                id: channelId,
                title: ministryName,
                type: 'group',
                church_id: churchId,
                created_by: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                participants: [userId],
            });

            return { conversationId: channelId, error: null };
        }

        // 2. Not found -> Create new ministry group conversation
        console.log(`[Messaging] Creating new ministry channel "${ministryName}" in Supabase...`);
        const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
                title: ministryName,
                type: 'group',
                church_id: churchId,
                created_by: userId,
            } as any)
            .select('id')
            .single();

        if (createError) {
            console.warn('⚠️ [Messaging] Supabase error creating ministry channel, using fallback:', createError);
            throw createError;
        }

        if (newConv?.id) {
            const newChannelId = newConv.id;
            await supabase
                .from('conversation_participants')
                .insert({ conversation_id: newChannelId, user_id: userId } as any);

            saveLocalMinistryConv({
                id: newChannelId,
                title: ministryName,
                type: 'group',
                church_id: churchId,
                created_by: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                participants: [userId],
            });

            console.log(`✅ [Messaging] Ministry channel created successfully: ${newChannelId}`);
            return { conversationId: newChannelId, error: null };
        }

        throw new Error('Failed to create ministry group channel');
    } catch (err: any) {
        console.warn('⚠️ [Messaging] Robust fallback triggered for getOrCreateMinistryChannel:', err);
        const fallbackConvId = `ministry-${churchId.slice(0, 8)}-${ministryId}`;
        saveLocalMinistryConv({
            id: fallbackConvId,
            title: ministryName,
            type: 'group',
            church_id: churchId,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            participants: [userId],
        });
        return { conversationId: fallbackConvId, error: null };
    }
}

/**
 * Fetch available ministry channels for a given church, matching canonical definitions
 * and returning live conversation status, participant count, and join state.
 */
export async function fetchChurchMinistryChannels(
    churchId: string,
    currentUserId?: string
): Promise<{
    data: ChurchMinistryChannelItem[] | null;
    error: Error | null;
}> {
    try {
        if (!churchId) {
            return { data: [], error: null };
        }

        // 1. Fetch group conversations for this church from Supabase
        const { data: existingConvs, error: convError } = await supabase
            .from('conversations')
            .select('*, church:churches(*)')
            .eq('church_id', churchId)
            .eq('type', 'group');

        const convsList = (!convError && existingConvs) ? existingConvs : [];
        const participantCountMap = new Map<string, number>();
        const userJoinedSet = new Set<string>();

        if (convsList.length > 0) {
            const convIds = convsList.map((c) => c.id);
            const { data: partRows } = await supabase
                .from('conversation_participants')
                .select('conversation_id, user_id')
                .in('conversation_id', convIds);

            (partRows || []).forEach((p: any) => {
                participantCountMap.set(
                    p.conversation_id,
                    (participantCountMap.get(p.conversation_id) || 0) + 1
                );
                if (currentUserId && p.user_id === currentUserId) {
                    userJoinedSet.add(p.conversation_id);
                }
            });
        }

        // Check local storage for any locally active ministry channels
        const localConvs = getLocalMinistryConvs(churchId);
        const localConvMap = new Map<string, LocalMinistryConv>();
        localConvs.forEach((lc) => {
            localConvMap.set(lc.title, lc);
        });

        // Map all canonical ministries
        const results: ChurchMinistryChannelItem[] = PARISH_MINISTRIES.map((ministry) => {
            const foundConv = convsList.find((c) => c.title === ministry.name);
            const foundLocal = localConvMap.get(ministry.name);

            const convId = foundConv?.id || foundLocal?.id || null;
            let count = 0;
            let joined = false;

            if (foundConv) {
                count = participantCountMap.get(foundConv.id) || 1;
                joined = userJoinedSet.has(foundConv.id);
            } else if (foundLocal) {
                count = foundLocal.participants?.length || 1;
                joined = currentUserId ? foundLocal.participants?.includes(currentUserId) : true;
            }

            return {
                id: convId || ministry.id,
                ministryId: ministry.id,
                conversationId: convId,
                name: ministry.name,
                title: ministry.name,
                description: ministry.description,
                category: ministry.category,
                iconName: ministry.iconName,
                isJoined: joined,
                participantCount: count,
            };
        });

        return { data: results, error: null };
    } catch (err: any) {
        console.warn('⚠️ [Messaging] fetchChurchMinistryChannels fallback:', err);
        const localConvs = getLocalMinistryConvs(churchId);
        const localConvMap = new Map<string, LocalMinistryConv>();
        localConvs.forEach((lc) => localConvMap.set(lc.title, lc));

        const fallbackResults: ChurchMinistryChannelItem[] = PARISH_MINISTRIES.map((ministry) => {
            const local = localConvMap.get(ministry.name);
            return {
                id: local?.id || ministry.id,
                ministryId: ministry.id,
                conversationId: local?.id || null,
                name: ministry.name,
                title: ministry.name,
                description: ministry.description,
                category: ministry.category,
                iconName: ministry.iconName,
                isJoined: local && currentUserId ? local.participants?.includes(currentUserId) : false,
                participantCount: local?.participants?.length || 0,
            };
        });

        return { data: fallbackResults, error: null };
    }
}

/**
 * Mark a conversation as read by the user
 */
export async function markConversationAsRead(
    conversationId: string,
    userId: string
): Promise<{ error: Error | null }> {
    try {
        if (isLocalConversation(conversationId)) {
            return { error: null };
        }

        const { error } = await supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .match({ conversation_id: conversationId, user_id: userId });

        if (error) throw error;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(UNREAD_CHANGED_EVENT));
        }
        return { error: null };
    } catch (err: any) {
        console.error('❌ Error marking conversation as read:', err);
        return { error: err };
    }
}

/**
 * Fetch available contacts (clergy, administrators, staff members, and parishioners) to start new conversations.
 * Includes associated church details via PostgREST join or mapped fallback.
 */
export async function fetchAvailableContacts(
    currentUserId: string,
    churchId?: string | null,
    currentUserRole?: string | null
): Promise<{
    data: ContactProfile[] | null;
    error: Error | null;
}> {
    try {
        console.log(`[Messaging] Fetching available contacts (currentUserId: ${currentUserId}, churchId: ${churchId || 'all'}, role: ${currentUserRole || 'auto'})...`);

        // Determine caller's role if not explicitly passed
        let resolvedRole = currentUserRole;
        let myProfile: { role?: string | null; church_id?: string | null; assigned_church_id?: string | null } | null = null;
        if (!resolvedRole || resolvedRole === 'volunteer') {
            const { data: profileRow } = await supabase
                .from('profiles')
                .select('role, church_id, assigned_church_id')
                .eq('id', currentUserId)
                .maybeSingle();
            myProfile = profileRow;
            resolvedRole = resolvedRole || profileRow?.role || 'user';
        }

        // Volunteers can only reach the church admins and volunteers of their own parish
        const isVolunteer = resolvedRole === 'volunteer';
        const volunteerChurchId = myProfile?.assigned_church_id || myProfile?.church_id || null;
        if (isVolunteer) {
            if (!volunteerChurchId) return { data: [], error: null };
            churchId = null;
        }
        const applyVolunteerScope = <T extends { in: (c: string, v: string[]) => T; or: (f: string) => T }>(q: T): T =>
            isVolunteer
                ? q
                      .in('role', ['church_admin', 'volunteer'])
                      .or(`church_id.eq.${volunteerChurchId},assigned_church_id.eq.${volunteerChurchId}`)
                : q;

        // Attempt joined query with assigned_church and church relations
        let query = supabase
            .from('profiles')
            .select(`
                *,
                assigned_church:churches!assigned_church_id(id, name),
                church:churches!church_id(id, name)
            `)
            .neq('id', currentUserId)
            .order('full_name', { ascending: true });

        // Strict Gateway for parishioners: push role filtering directly to DB query
        // before applying limit(100) so staff are not starved out by parishioners
        if (resolvedRole === 'user') {
            query = query.in('role', ['super_admin', 'admin', 'church_admin']);
        }

        query = applyVolunteerScope(query);

        if (churchId) {
            query = query.or(`church_id.eq.${churchId},assigned_church_id.eq.${churchId},role.in.(admin,super_admin)`);
        }

        const { data, error } = await query.limit(100);

        if (!error && data) {
            let normalizedData: ContactProfile[] = (data as any[]).map((p) => ({
                ...p,
                assigned_church: p.assigned_church || p.church || null,
            }));

            // Strict Gateway: Parishioners can ONLY contact leadership/administrators:
            // super_admin, admin, church_admin (parish admin).
            // Parishioners can NEVER contact other parishioners or cold-message clergy.
            if (resolvedRole === 'user') {
                normalizedData = normalizedData.filter(
                    (p) => ['super_admin', 'admin', 'church_admin'].includes(p.role || '') && !p.is_priest
                );
            }

            if (isVolunteer && myProfile) {
                normalizedData = normalizedData.filter((p) => isVolunteerAllowedContact(myProfile!, p));
            }

            return { data: normalizedData, error: null };
        }

        if (error) {
            console.warn('⚠️ [Messaging] Joined contact query error, falling back to direct mapping:', error);

            // Fallback: simple profile query + mapping church names
            let fallbackQuery = supabase
                .from('profiles')
                .select('*')
                .neq('id', currentUserId)
                .order('full_name', { ascending: true });

            if (resolvedRole === 'user') {
                fallbackQuery = fallbackQuery.in('role', ['super_admin', 'admin', 'church_admin']);
            }

            fallbackQuery = applyVolunteerScope(fallbackQuery);

            if (churchId) {
                fallbackQuery = fallbackQuery.or(`church_id.eq.${churchId},assigned_church_id.eq.${churchId},role.in.(admin,super_admin)`);
            }

            const { data: rawProfiles, error: fallbackError } = await fallbackQuery.limit(100);
            if (fallbackError) throw fallbackError;

            // Fetch churches to map names
            const { data: churchesData } = await supabase
                .from('churches')
                .select('id, name');

            const churchMap = new Map<string, { id: string; name: string }>();
            (churchesData || []).forEach((ch: any) => {
                churchMap.set(ch.id, { id: ch.id, name: ch.name });
            });

            let mappedData: ContactProfile[] = (rawProfiles || []).map((p: any) => {
                const cId = p.assigned_church_id || p.church_id;
                const churchObj = cId ? churchMap.get(cId) || null : null;
                return {
                    ...p,
                    assigned_church: churchObj,
                    church: churchObj,
                };
            });

            // Strict Gateway: Parishioners can ONLY contact leadership/administrators
            if (resolvedRole === 'user') {
                mappedData = mappedData.filter(
                    (p) => ['super_admin', 'admin', 'church_admin'].includes(p.role || '') && !p.is_priest
                );
            }

            if (isVolunteer && myProfile) {
                mappedData = mappedData.filter((p) => isVolunteerAllowedContact(myProfile!, p));
            }

            return { data: mappedData, error: null };
        }

        return { data: [], error: null };
    } catch (err: any) {
        console.error('❌ Error fetching contacts:', err);
        return { data: null, error: err };
    }
}

/**
 * Generate a unique, safe Jitsi conference room name
 */
export function generateMeetingRoomName(conversationId: string, prefix = 'sacralink'): string {
    const cleanId = conversationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${prefix}-${cleanId}-${randomSuffix}`;
}

/**
 * Subscribe to real-time message stream for a conversation
 */
export function subscribeToMessages(
    conversationId: string,
    onMessage: (message: MessageWithSender) => void
) {
    if (isLocalConversation(conversationId)) {
        const localHandler = (e: Event) => {
            const customEvent = e as CustomEvent<MessageWithSender>;
            if (customEvent.detail && customEvent.detail.conversation_id === conversationId) {
                onMessage(customEvent.detail);
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('sacralink:local_message', localHandler);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('sacralink:local_message', localHandler);
            }
        };
    }

    const channelName = `realtime:messages:${conversationId}`;

    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`,
            },
            async (payload) => {
                const rawMessage = payload.new as Message;

                // Fetch sender profile details to provide complete MessageWithSender object
                let senderProfile: Profile | null = null;
                if (rawMessage.sender_id) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', rawMessage.sender_id)
                        .maybeSingle();
                    senderProfile = data as Profile | null;
                }

                const enrichedMessage: MessageWithSender = {
                    ...rawMessage,
                    sender: senderProfile,
                };

                onMessage(enrichedMessage);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`📡 Realtime connected to chat room: ${conversationId}`);
            }
        });

    // Also listen to local window and storage events for offline/demo messages across tabs
    const localHandler = (e: Event) => {
        const customEvent = e as CustomEvent<MessageWithSender>;
        if (customEvent.detail && customEvent.detail.conversation_id === conversationId) {
            onMessage(customEvent.detail);
        }
    };
    const storageHandler = (e: StorageEvent) => {
        if (e.key === localMessagesKey(conversationId) && e.newValue) {
            try {
                const parsed: MessageWithSender[] = JSON.parse(e.newValue);
                if (parsed.length > 0) {
                    onMessage(parsed[parsed.length - 1]);
                }
            } catch (err) {
                console.warn('Could not parse storage event for message:', err);
            }
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('sacralink:local_message', localHandler);
        window.addEventListener('storage', storageHandler);
    }

    return () => {
        supabase.removeChannel(channel);
        if (typeof window !== 'undefined') {
            window.removeEventListener('sacralink:local_message', localHandler);
            window.removeEventListener('storage', storageHandler);
        }
    };
}

/**
 * Subscribe to all real-time message stream for user conversations
 */
export function subscribeToUserConversations(
    userId: string,
    onNewMessage: (message: MessageWithSender) => void
) {
    const channelName = `realtime:user_conversations:${userId}`;

    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            },
            async (payload) => {
                const rawMessage = payload.new as Message;
                if (!rawMessage || !rawMessage.id) return;

                // Fetch sender profile details to provide complete MessageWithSender object
                let senderProfile: Profile | null = null;
                if (rawMessage.sender_id) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', rawMessage.sender_id)
                        .maybeSingle();
                    senderProfile = data as Profile | null;
                }

                const enrichedMessage: MessageWithSender = {
                    ...rawMessage,
                    sender: senderProfile,
                };

                onNewMessage(enrichedMessage);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`📡 Realtime connected to user conversations stream: ${userId}`);
            }
        });

    const localHandler = (e: Event) => {
        const customEvent = e as CustomEvent<MessageWithSender>;
        if (customEvent.detail) {
            onNewMessage(customEvent.detail);
        }
    };
    const storageHandler = (e: StorageEvent) => {
        if (
            e.key &&
            localMessagingOwnerId &&
            e.key.startsWith(`${LOCAL_MINISTRY_MESSAGES_KEY}:${localMessagingOwnerId}_`) &&
            e.newValue
        ) {
            try {
                const parsed: MessageWithSender[] = JSON.parse(e.newValue);
                if (parsed.length > 0) {
                    onNewMessage(parsed[parsed.length - 1]);
                }
            } catch (err) {
                console.warn('Could not parse storage event for message stream:', err);
            }
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('sacralink:local_message', localHandler);
        window.addEventListener('storage', storageHandler);
    }

    return () => {
        supabase.removeChannel(channel);
        if (typeof window !== 'undefined') {
            window.removeEventListener('sacralink:local_message', localHandler);
            window.removeEventListener('storage', storageHandler);
        }
    };
}

/**
 * Delete a conversation for the current user only ("Delete for Me")
 * Removes the user from conversation_participants
 */
export async function deleteConversationForMe(
    conversationId: string,
    userId: string
): Promise<{ error: Error | null }> {
    try {
        // Verify conversation type is not channel or group
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('type')
            .eq('id', conversationId)
            .single();

        if (convError && !isLocalConversation(conversationId)) throw convError;
        if (conv?.type === 'channel' || conv?.type === 'group' || isLocalConversation(conversationId)) {
            throw new Error('Parish staff channels and ministry group channels are permanent and cannot be deleted.');
        }

        const { error } = await supabase
            .from('conversation_participants')
            .delete()
            .match({ conversation_id: conversationId, user_id: userId });

        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        console.error('❌ Error deleting conversation for user:', err);
        return { error: err };
    }
}

/**
 * Delete a conversation completely for everyone ("Delete for Everyone")
 * Deletes the conversation row from conversations table (cascades to messages & participants)
 */
export async function deleteConversationForEveryone(
    conversationId: string
): Promise<{ error: Error | null }> {
    try {
        // Verify conversation type is not channel or group
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('type')
            .eq('id', conversationId)
            .single();

        if (convError && !isLocalConversation(conversationId)) throw convError;
        if (conv?.type === 'channel' || conv?.type === 'group' || isLocalConversation(conversationId)) {
            throw new Error('Parish staff channels and ministry group channels are permanent and cannot be deleted.');
        }

        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId);

        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        console.error('❌ Error deleting conversation for everyone:', err);
        return { error: err };
    }
}

export interface SubmitParishOfficeInquiryParams {
    churchId: string;
    userId: string;
    subject: string;
    message: string;
    category?: string;
    churchName?: string;
}

/**
 * Submit an inquiry ticket to a parish office.
 * Creates or links a shared group conversation tagged with church_id,
 * adds the inquiring user and all parish office administrators/staff/priests as participants,
 * and inserts the initial inquiry message with category and ticket_number.
 */
export async function submitParishOfficeInquiry({
    churchId,
    userId,
    subject,
    message,
    category,
    churchName,
}: SubmitParishOfficeInquiryParams): Promise<{
    conversationId: string | null;
    error: Error | null;
}> {
    try {
        if (!churchId || !userId) {
            throw new Error('Church ID and User ID are required to submit an inquiry');
        }
        if (!subject || subject.trim().length < 3) {
            throw new Error('Subject must be at least 3 characters long');
        }
        if (!message || message.trim().length < 10) {
            throw new Error('Message must be at least 10 characters long');
        }

        console.log(`[Messaging] Submitting parish office inquiry for church: ${churchId}, user: ${userId}`);

        // 1. Fetch church name if not provided
        let resolvedChurchName = churchName;
        if (!resolvedChurchName) {
            const { data: churchData } = await supabase
                .from('churches')
                .select('name')
                .eq('id', churchId)
                .maybeSingle();
            resolvedChurchName = churchData?.name || 'Parish';
        }

        // 2. Find all active staff and priests for the church (church_admin, admin, super_admin, priest)
        const [staffQuery1, staffQuery2] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, role, is_priest')
                .eq('church_id', churchId)
                .or('role.in.(church_admin,admin,super_admin,priest),is_priest.eq.true'),
            supabase
                .from('profiles')
                .select('id, role, is_priest')
                .eq('assigned_church_id', churchId)
                .or('role.in.(church_admin,admin,super_admin,priest),is_priest.eq.true'),
        ]);

        const staffIds = new Set<string>();
        (staffQuery1.data || []).forEach((p: any) => staffIds.add(p.id));
        (staffQuery2.data || []).forEach((p: any) => staffIds.add(p.id));

        const now = new Date().toISOString();
        const convTitle = `Inquiry: ${subject.trim()}`;
        const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;
        const ticketCategory = category || 'general';

        // 3. Create a shared conversation tagged with church_id, ticket_number, status, and category
        const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
                title: convTitle,
                type: 'group',
                church_id: churchId,
                created_by: userId,
                category: ticketCategory,
                status: 'open',
                ticket_number: ticketNumber,
                created_at: now,
                updated_at: now,
            } as any)
            .select('id')
            .single();

        let conversationId = newConv?.id;

        if (createError || !conversationId) {
            console.warn('⚠️ [Messaging] Supabase insert failed, checking fallback:', createError);
            // Local fallback for offline/demo environments
            conversationId = `inquiry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const allParticipants = Array.from(new Set([userId, ...staffIds]));
            saveLocalMinistryConv({
                id: conversationId,
                title: convTitle,
                type: 'group',
                church_id: churchId,
                church_name: resolvedChurchName,
                created_by: userId,
                category: ticketCategory,
                status: 'open',
                ticket_number: ticketNumber,
                created_at: now,
                updated_at: now,
                participants: allParticipants,
            });
        } else {
            // 4. Ensure inquiring user and all parish staff are added as conversation participants
            const allParticipants = Array.from(new Set([userId, ...staffIds]));
            const participantInserts = allParticipants.map((uid) => ({
                conversation_id: conversationId!,
                user_id: uid,
                created_at: now,
                last_read_at: uid === userId ? now : null,
            }));

            const { error: partError } = await supabase
                .from('conversation_participants')
                .insert(participantInserts as any);

            if (partError) {
                console.warn('⚠️ [Messaging] Could not insert all participants in Supabase:', partError);
            }
        }

        // 5. Insert initial message with the inquiry format and ticket metadata
        const initialContent = `[Inquiry: ${subject.trim()}]\n\n${message.trim()}`;
        const { error: msgError } = await sendMessage(
            conversationId,
            userId,
            initialContent,
            'text',
            {
                inquiry_subject: subject.trim(),
                church_id: churchId,
                category: ticketCategory,
                ticket_number: ticketNumber,
            }
        );

        if (msgError) {
            console.warn('⚠️ [Messaging] Could not post initial inquiry message:', msgError);
        }

        return { conversationId, error: null };
    } catch (err: any) {
        console.error('❌ Error submitting parish office inquiry:', err);
        return { conversationId: null, error: err };
    }
}

/**
 * Update the status of a ticket conversation (open, in_progress, resolved, closed)
 */
export async function updateTicketStatus(
    conversationId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
): Promise<{
    error: Error | null;
}> {
    try {
        const now = new Date().toISOString();

        if (isLocalConversation(conversationId)) {
            const localConvs = getLocalMinistryConvs();
            const conv = localConvs.find((c) => c.id === conversationId);
            if (conv) {
                conv.status = status;
                conv.updated_at = now;
                saveLocalMinistryConv(conv);
            }
            return { error: null };
        }

        const { error } = await supabase
            .from('conversations')
            .update({
                status,
                updated_at: now,
            } as any)
            .eq('id', conversationId);

        if (error) throw error;
        return { error: null };
    } catch (err: any) {
        console.error('❌ Error updating ticket status:', err);
        return { error: err };
    }
}

/**
 * Reopen a closed ticket (requester or parish staff) and log a system status note in the thread.
 */
export async function reopenTicket(
    conversationId: string,
    userId: string,
    actorName?: string | null
): Promise<{
    data: MessageWithSender | null;
    error: Error | null;
}> {
    const { error } = await updateTicketStatus(conversationId, 'open');
    if (error) return { data: null, error };
    return sendMessage(
        conversationId,
        userId,
        `${actorName?.trim() || 'A participant'} reopened this ticket.`,
        'system',
        { event: 'ticket_reopened' }
    );
}
