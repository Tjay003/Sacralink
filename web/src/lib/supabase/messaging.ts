import { supabase } from '../supabase';
import type { Conversation, ConversationParticipant, Message, Profile, Church } from '../../types/database';

export interface ParticipantWithProfile extends ConversationParticipant {
    profile?: Profile | null;
}

export interface MessageWithSender extends Message {
    sender?: Profile | null;
}

export interface ConversationWithDetails extends Conversation {
    participants: ParticipantWithProfile[];
    lastMessage?: MessageWithSender | null;
    unreadCount: number;
    church?: Church | null;
    otherParticipant?: Profile | null; // For 1-on-1 direct chats
}

export interface ContactProfile extends Profile {
    assigned_church?: { id: string; name: string } | null;
    church?: { id: string; name: string } | null;
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

                return {
                    ...conv,
                    participants: parts,
                    lastMessage: lastMsg,
                    unreadCount,
                    church: conv.church || null,
                    otherParticipant: otherPart,
                };
            })
        );

        // Sort by updated_at descending
        enrichedConversations.sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        return { data: enrichedConversations, error: null };
    } catch (err: any) {
        console.error('❌ Error fetching user conversations:', err);
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
        const { data: rawMessages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!rawMessages || rawMessages.length === 0) {
            return { data: [], error: null };
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

        return { data: enrichedMessages, error: null };
    } catch (err: any) {
        console.error('❌ Error fetching messages:', err);
        return { data: null, error: err };
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
    try {
        const now = new Date().toISOString();
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
        console.error('❌ Error sending message:', err);
        return { data: null, error: err };
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
    churchId?: string | null
): Promise<{
    data: ContactProfile[] | null;
    error: Error | null;
}> {
    try {
        console.log(`[Messaging] Fetching available contacts (currentUserId: ${currentUserId}, churchId: ${churchId || 'all'})...`);

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
            const normalizedData: ContactProfile[] = (data as any[]).map((p) => ({
                ...p,
                assigned_church: p.assigned_church || p.church || null,
            }));
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

            const mappedData: ContactProfile[] = (rawProfiles || []).map((p: any) => {
                const cId = p.assigned_church_id || p.church_id;
                const churchObj = cId ? churchMap.get(cId) || null : null;
                return {
                    ...p,
                    assigned_church: churchObj,
                    church: churchObj,
                };
            });

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

    return () => {
        supabase.removeChannel(channel);
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

    return () => {
        supabase.removeChannel(channel);
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
        // Verify conversation type is not channel
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('type')
            .eq('id', conversationId)
            .single();

        if (convError) throw convError;
        if (conv?.type === 'channel') {
            throw new Error('Parish staff channels are permanent and cannot be deleted.');
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
        // Verify conversation type is not channel
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .select('type')
            .eq('id', conversationId)
            .single();

        if (convError) throw convError;
        if (conv?.type === 'channel') {
            throw new Error('Parish staff channels are permanent and cannot be deleted.');
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

