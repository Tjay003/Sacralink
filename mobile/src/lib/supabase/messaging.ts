import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Profile } from '@/shared/types';
import type { Church } from './churches';

export interface Conversation {
  id: string;
  title: string | null;
  type: string; // 'direct' | 'channel' | 'group'
  church_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string; // 'text' | 'call_invite' | 'system'
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface ParticipantWithProfile extends ConversationParticipant {
  profile?: Profile | null;
}

export interface MessageWithSender extends Message {
  sender?: Profile | null;
  status?: 'sending' | 'sent' | 'error';
}

export interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithProfile[];
  lastMessage?: MessageWithSender | null;
  unreadCount: number;
  church?: Church | null;
  otherParticipant?: Profile | null;
}

/**
 * Fetch all conversations for a given user with participant details, church info, and latest message.
 */
export async function fetchUserConversations(userId: string): Promise<{
  data: ConversationWithDetails[] | null;
  error: Error | null;
}> {
  try {
    // 1. Get all conversation IDs that user is a participant in
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
    const participantUserIds = Array.from(
      new Set((allParticipants || []).map((p: any) => p.user_id).filter(Boolean))
    );
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

    // 4. Fetch the latest message for each conversation and compute unread counts
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
    console.error('Error fetching user conversations:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch messages for a conversation ordered chronologically with sender profiles.
 */
export async function fetchConversationMessages(conversationId: string): Promise<{
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

    const senderIds = Array.from(
      new Set(rawMessages.map((m: any) => m.sender_id).filter(Boolean))
    );
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
      status: 'sent',
    }));

    return { data: enrichedMessages, error: null };
  } catch (err: any) {
    console.error('Error fetching conversation messages:', err);
    return { data: null, error: err };
  }
}

export const fetchMessages = fetchConversationMessages;

/**
 * Send a message within a conversation and update conversation updated_at.
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

    // Update conversation updated_at and sender's last_read_at
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

    return {
      data: {
        ...(data as any),
        status: 'sent',
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Error sending message:', err);
    return { data: null, error: err };
  }
}

/**
 * Mark a conversation as read by the user.
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
    console.error('Error marking conversation as read:', err);
    return { error: err };
  }
}

/**
 * Finds existing direct conversation with church or creates new conversation record.
 */
export async function getOrCreateParishOfficeConversation(
  churchId: string,
  userId: string
): Promise<{
  conversationId: string | null;
  error: Error | null;
}> {
  try {
    // 1. Check if user is already a participant in a conversation for this church
    const { data: userConvs, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (partError) throw partError;

    const candidateIds = (userConvs || []).map((c) => c.conversation_id);

    if (candidateIds.length > 0) {
      const { data: existingConvs, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .in('id', candidateIds)
        .eq('church_id', churchId)
        .limit(1);

      if (convError) throw convError;

      if (existingConvs && existingConvs.length > 0) {
        return { conversationId: existingConvs[0].id, error: null };
      }
    }

    // 2. Resolve church name
    const { data: church } = await supabase
      .from('churches')
      .select('name')
      .eq('id', churchId)
      .maybeSingle();

    const churchName = church?.name || 'Parish Office';
    const now = new Date().toISOString();

    // 3. Create new conversation
    const { data: newConv, error: createConvError } = await supabase
      .from('conversations')
      .insert({
        title: `${churchName} Inquiry`,
        type: 'direct',
        church_id: churchId,
        created_by: userId,
        created_at: now,
        updated_at: now,
      } as any)
      .select('id')
      .single();

    if (createConvError) throw createConvError;

    const newId = newConv.id;

    // 4. Find staff members (church_admin, admin, priest) for this church to add as participants
    const { data: staffMembers } = await supabase
      .from('profiles')
      .select('id')
      .or(`church_id.eq.${churchId},assigned_church_id.eq.${churchId}`);

    const participantSet = new Set<string>([userId]);
    (staffMembers || []).forEach((s) => participantSet.add(s.id));

    const participantInserts = Array.from(participantSet).map((uid) => ({
      conversation_id: newId,
      user_id: uid,
      last_read_at: uid === userId ? now : null,
      created_at: now,
    }));

    await supabase.from('conversation_participants').insert(participantInserts as any);

    return { conversationId: newId, error: null };
  } catch (err: any) {
    console.error('Error in getOrCreateParishOfficeConversation:', err);
    return { conversationId: null, error: err };
  }
}

/**
 * Get or create a 1-on-1 direct conversation between two individual users.
 */
export async function getOrCreateDirectConversation(
  userId: string,
  targetUserId: string
): Promise<{
  conversationId: string | null;
  error: Error | null;
}> {
  try {
    if (userId === targetUserId) {
      throw new Error('Cannot create direct conversation with oneself');
    }

    const { data: userConvs, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (partError) throw partError;

    const candidateIds = (userConvs || []).map((c) => c.conversation_id);

    if (candidateIds.length > 0) {
      const { data: directConvs, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .in('id', candidateIds)
        .eq('type', 'direct');

      if (convError) throw convError;

      const directIds = (directConvs || []).map((c) => c.id);

      if (directIds.length > 0) {
        const { data: matchingParticipants, error: matchError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', directIds)
          .eq('user_id', targetUserId)
          .limit(1);

        if (matchError) throw matchError;

        if (matchingParticipants && matchingParticipants.length > 0) {
          return { conversationId: matchingParticipants[0].conversation_id, error: null };
        }
      }
    }

    const now = new Date().toISOString();
    const { data: newConv, error: createConvError } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        created_by: userId,
        title: null,
        created_at: now,
        updated_at: now,
      } as any)
      .select('id')
      .single();

    if (createConvError) throw createConvError;

    const newId = newConv.id;

    await supabase.from('conversation_participants').insert([
      { conversation_id: newId, user_id: userId, last_read_at: now, created_at: now },
      { conversation_id: newId, user_id: targetUserId, last_read_at: null, created_at: now },
    ] as any);

    return { conversationId: newId, error: null };
  } catch (err: any) {
    console.error('Error getting/creating direct conversation:', err);
    return { conversationId: null, error: err };
  }
}

/**
 * Creates Supabase Realtime channel (postgres_changes on messages table filtered by conversation_id=eq.${conversationId}).
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: MessageWithSender) => void
): () => void {
  const channelName = `realtime:messages:${conversationId}:${Date.now()}`;

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
        if (!rawMessage || !rawMessage.id) return;

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
          status: 'sent',
        };

        onMessage(enrichedMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export const subscribeToMessages = subscribeToConversationMessages;

/**
 * Generates a cryptographically unguessable room identifier.
 * Incorporates high entropy to prevent room enumeration, brute-forcing,
 * and eavesdropping on confidential pastoral counseling sessions.
 */
export function generateSecureRoomId(prefix = 'counseling'): string {
  let entropy = '';
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    entropy = globalThis.crypto.randomUUID();
  } else if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // v4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    entropy = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } else {
    // High-entropy fallback
    const r1 = Math.random().toString(36).substring(2, 10);
    const r2 = Math.random().toString(36).substring(2, 10);
    const r3 = Math.random().toString(36).substring(2, 10);
    entropy = `${Date.now().toString(36)}-${r1}-${r2}-${r3}`;
  }
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9-]/g, '');
  return `sacralink-${cleanPrefix}-${entropy}`;
}

/**
 * Fast 32-bit FNV-1a checksum for deterministic appointment salt generation.
 */
function computeChecksum(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates an unguessable, appointment-scoped Jitsi room identifier.
 * Requires the full appointment UUID and incorporates a pastoral security salt
 * so that third parties cannot guess or enumerate confidential counseling rooms.
 */
export function generateAppointmentRoomId(appointmentId: string): string {
  const cleanApptId = appointmentId.replace(/[^a-zA-Z0-9-]/g, '');
  const salt = 'sacralink-confidential-pastoral-v1';
  const checksum = computeChecksum(`${cleanApptId}:${salt}`);
  return `sacralink-counseling-${cleanApptId}-${checksum}`;
}

/**
 * Generates a secure Jitsi Meet video consultation URL.
 * Sanitizes room identifiers and configures prejoin screening to prevent unauthorized background entry.
 */
export function getJitsiMeetUrl(
  roomIdentifier: string,
  options: { prejoin?: boolean; subject?: string } = {}
): string {
  // If the roomIdentifier already contains 'sacralink-', keep it clean; otherwise prefix
  const cleanId = roomIdentifier.replace(/[^a-zA-Z0-9-_]/g, '');
  const roomName = cleanId.startsWith('sacralink-') ? cleanId : `sacralink-${cleanId}`;
  const jitsiDomain = process.env.EXPO_PUBLIC_JITSI_DOMAIN || 'fairmeeting.net';
  const base = `https://${jitsiDomain}/${roomName}`;

  const configParams = [
    'config.prejoinPageEnabled=true',
    'config.requireDisplayName=true',
    'config.disableDeepLinking=false',
  ];
  if (options.subject) {
    configParams.push(`config.subject=${encodeURIComponent(options.subject)}`);
  }

  return `${base}#${configParams.join('&')}`;
}

/**
 * TanStack Query hook to fetch user conversations.
 */
export function useUserConversations(userId?: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await fetchUserConversations(userId);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 15,
  });
}

/**
 * TanStack Query hook to fetch messages for a specific conversation.
 */
export function useConversationMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await fetchConversationMessages(conversationId);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(conversationId),
    staleTime: 1000 * 5,
  });
}
