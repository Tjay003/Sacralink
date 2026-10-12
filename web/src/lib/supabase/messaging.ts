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
}

export interface ContactProfile extends Profile {
    assigned_church?: { id: string; name: string } | null;
    church?: { id: string; name: string } | null;
}

// ============================================================================
// OFFLINE & DEMO FALLBACK STORAGE HELPERS
// ============================================================================
const LOCAL_MINISTRY_STORAGE_KEY = 'sacralink_local_ministry_convs';
const LOCAL_MINISTRY_MESSAGES_KEY = 'sacralink_local_ministry_messages';

interface LocalMinistryConv {
    id: string;
    title: string;
    type: string;
    church_id: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    participants: string[];
}

function getLocalMinistryConvs(churchId?: string): LocalMinistryConv[] {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];
    try {
        const raw = window.sessionStorage.getItem(LOCAL_MINISTRY_STORAGE_KEY);
        const list: LocalMinistryConv[] = raw ? JSON.parse(raw) : [];
        if (churchId) {
            return list.filter((c) => c.church_id === churchId);
        }
        return list;
    } catch {
        return [];
    }
}

function saveLocalMinistryConv(conv: LocalMinistryConv): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        const list = getLocalMinistryConvs();
        const existingIdx = list.findIndex(
            (c) => c.id === conv.id || (c.church_id === conv.church_id && c.title === conv.title)
        );
        if (existingIdx >= 0) {
            const existing = list[existingIdx];
            const mergedParticipants = Array.from(new Set([...existing.participants, ...conv.participants]));
            list[existingIdx] = { ...existing, ...conv, participants: mergedParticipants };
        } else {
            list.push(conv);
        }
        window.sessionStorage.setItem(LOCAL_MINISTRY_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('Could not save local ministry conv:', e);
    }
}

function getLocalMinistryMessages(conversationId: string): MessageWithSender[] {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];
    try {
        const raw = window.sessionStorage.getItem(`${LOCAL_MINISTRY_MESSAGES_KEY}_${conversationId}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalMinistryMessage(msg: MessageWithSender): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        const list = getLocalMinistryMessages(msg.conversation_id);
        if (!list.some((m) => m.id === msg.id)) {
            list.push(msg);
            window.sessionStorage.setItem(`${LOCAL_MINISTRY_MESSAGES_KEY}_${msg.conversation_id}`, JSON.stringify(list));
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
        // 1. Get all conversation IDs that user is participant in
        const { data: participantRows, error: participantError } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('user_id', userId);

        if (participantError) throw participantError;

        const conversationIds = (participantRows || []).map((p) => p.conversation_id);
        const lastReadMap = new Map<string, string | null>();
        (participantRows || []).forEach((p) => {
            lastReadMap.set(p.conversation_id, p.last_read_at);
        });

        if (conversationIds.length === 0) {
            return { data: [], error: null };
        }

        // 2. Fetch conversation rows with associated church
        const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('*, church:churches(*)')
            .in('id', conversationIds)
            .order('updated_at', { ascending: false });

        if (convError) throw convError;

        if (!conversations || conversations.length === 0) {
            return { data: [], error: null };
        }

        // 3. Fetch all participants for these conversations
        const { data: allParticipants, error: allPartError } = await supabase
            .from('conversation_participants')
            .select('*')
            .in('conversation_id', conversationIds);

        if (allPartError) throw allPartError;

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
        const enrichedConversations: ConversationWithDetails[] = await Promise.all(
            conversations.map(async (conv: any) => {
                const parts = participantsByConv.get(conv.id) || [];
                const userLastRead = lastReadMap.get(conv.id);

                // Fetch latest message
                const { data: latestMessages } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                let lastMsg: MessageWithSender | null = null;
                if (latestMessages && latestMessages.length > 0) {
                    const rawMsg = latestMessages[0] as any;
                    lastMsg = {
                        ...rawMsg,
                        sender: profileMap.get(rawMsg.sender_id) || null,
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

                return {
                    ...conv,
                    participants: parts,
                    lastMessage: lastMsg,
                    unreadCount,
                    church: conv.church || null,
                    otherParticipant: otherPart,
                    ministry: ministryDef,
                };
            })
        );

        // Merge any local fallback ministry conversations the user is a participant in
        const localConvs = getLocalMinistryConvs();
        const userLocalConvs = localConvs.filter((lc) => lc.participants.includes(userId));
        userLocalConvs.forEach((lc) => {
            if (!enrichedConversations.some((c) => c.id === lc.id)) {
                const localMsgs = getLocalMinistryMessages(lc.id);
                const lastMsg = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
                enrichedConversations.push({
                    id: lc.id,
                    title: lc.title,
                    type: lc.type,
                    church_id: lc.church_id,
                    created_by: lc.created_by,
                    created_at: lc.created_at,
                    updated_at: lc.updated_at,
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
                    church: null,
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
        // Robust fallback: return user's local ministry conversations if any exist
        const localConvs = getLocalMinistryConvs();
        const userLocalConvs = localConvs.filter((lc) => lc.participants.includes(userId));
        if (userLocalConvs.length > 0) {
            const fallbackList: ConversationWithDetails[] = userLocalConvs.map((lc) => {
                const localMsgs = getLocalMinistryMessages(lc.id);
                const lastMsg = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
                return {
                    id: lc.id,
                    title: lc.title,
                    type: lc.type,
                    church_id: lc.church_id,
                    created_by: lc.created_by,
                    created_at: lc.created_at,
                    updated_at: lc.updated_at,
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
                    church: null,
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
        if (conversationId.startsWith('ministry-')) {
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
    messageType: 'text' | 'call_invite' = 'text',
    metadata: Record<string, unknown> = {}
): Promise<{
    data: MessageWithSender | null;
    error: Error | null;
}> {
    const now = new Date().toISOString();
    try {
        if (conversationId.startsWith('ministry-')) {
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
            supabase.from('profiles').select('id, role, is_priest').eq('id', userId).maybeSingle(),
            supabase.from('profiles').select('id, role, is_priest').eq('id', targetUserId).maybeSingle(),
        ]);

        const callerRole = callerProfileRes.data?.role || 'user';
        const targetRole = targetProfileRes.data?.role || 'user';
        const isTargetPriest = targetRole === 'priest' || targetProfileRes.data?.is_priest === true;
        const isCallerPriest = callerRole === 'priest' || callerProfileRes.data?.is_priest === true;

        if (callerRole === 'user' && isTargetPriest) {
            throw new Error('Parishioners cannot initiate direct conversations with clergy. Please message the Parish Office instead.');
        }

        if (callerRole === 'user' && !['super_admin', 'admin', 'church_admin'].includes(targetRole)) {
            throw new Error('Parishioners can only initiate direct conversations with Parish Office and Diocese administrators.');
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
        const [churchStaff1, churchStaff2] = await Promise.all([
            supabase
                .from('profiles')
                .select('id')
                .eq('church_id', churchId),
            supabase
                .from('profiles')
                .select('id')
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
        const { error } = await supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .match({ conversation_id: conversationId, user_id: userId });

        if (error) throw error;
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
        if (!resolvedRole) {
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUserId)
                .maybeSingle();
            resolvedRole = myProfile?.role || 'user';
        }

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
            // super_admin, admin (diocese admin), church_admin (parish admin).
            // Parishioners can NEVER contact other parishioners or cold-message clergy.
            if (resolvedRole === 'user') {
                normalizedData = normalizedData.filter(
                    (p) => ['super_admin', 'admin', 'church_admin'].includes(p.role || '') && !p.is_priest
                );
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

    // Also listen to local window event for offline/demo messages
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
        supabase.removeChannel(channel);
        if (typeof window !== 'undefined') {
            window.removeEventListener('sacralink:local_message', localHandler);
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
    if (typeof window !== 'undefined') {
        window.addEventListener('sacralink:local_message', localHandler);
    }

    return () => {
        supabase.removeChannel(channel);
        if (typeof window !== 'undefined') {
            window.removeEventListener('sacralink:local_message', localHandler);
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

        if (convError && !conversationId.startsWith('ministry-')) throw convError;
        if (conv?.type === 'channel' || conv?.type === 'group' || conversationId.startsWith('ministry-')) {
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

        if (convError && !conversationId.startsWith('ministry-')) throw convError;
        if (conv?.type === 'channel' || conv?.type === 'group' || conversationId.startsWith('ministry-')) {
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

