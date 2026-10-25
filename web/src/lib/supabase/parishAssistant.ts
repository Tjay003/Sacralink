import { supabase } from '../supabase';
import { generateFallbackResponse } from './aiFallback';

export interface ParishAssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BookingProposal {
  field: 'date' | 'time' | 'notes';
  value: string;
}

export type ParishAssistantIntent =
  | { type: 'start_booking'; serviceName?: string }
  | { type: 'change_step'; step: 'service' | 'date' | 'time' | 'priest' | 'notes' }
  | { type: 'cancel_booking' }
  | { type: 'draft_ticket'; category: string; subject: string; message: string };

export type BookingIntent = ParishAssistantIntent;

export interface ParishAssistantHandoff {
  type: 'appointment' | 'messages' | 'booking' | string;
  label: string;
  url: string;
}

export interface BookingDraftPayload {
  currentStep?: string;
  serviceTypeId?: string | null;
  serviceTypeName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  requestedPriestId?: string | null;
  requestedPriestName?: string | null;
  notes?: string | null;
}

export interface AskParishAssistantParams {
  message: string;
  churchId?: string | null;
  churchName?: string | null;
  conversationHistory?: ParishAssistantTurn[];
  bookingDraft?: BookingDraftPayload | null;
  timeoutMs?: number;
  customHeaders?: Record<string, string>;
  simulateQuota?: boolean;
}

export interface ToolCallTrace {
  name: string;
  args: Record<string, any>;
  result: any;
}

export interface AssistantDebugInfo {
  model: string;
  isMock: boolean;
  turns: number;
  tools: ToolCallTrace[];
}

export interface AskParishAssistantResult {
  reply: string;
  sourcesUsed: number;
  isFallback: boolean;
  isRateLimited?: boolean;
  bookingProposal?: BookingProposal | null;
  intent?: ParishAssistantIntent | null;
  handoff?: ParishAssistantHandoff | null;
  debug?: AssistantDebugInfo | null;
}

export const PARISH_ASSISTANT_TIMEOUT_MS = 30000;

/**
 * Invokes the `parish-assistant` Supabase Edge Function with automatic keyword
 * fallback to parish database tables if the edge function is unreachable,
 * offline, or times out.
 *
 * NOTE: Logging to `church_chat_logs` is handled strictly by the server
 * to prevent duplicate audit records.
 */
export async function askParishAssistant(
  params: AskParishAssistantParams
): Promise<AskParishAssistantResult> {
  const {
    message,
    churchId,
    churchName,
    conversationHistory = [],
    bookingDraft = null,
    timeoutMs = PARISH_ASSISTANT_TIMEOUT_MS,
    customHeaders = {},
    simulateQuota = false,
  } = params;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return {
      reply: 'Please provide a message or inquiry.',
      sourcesUsed: 0,
      isFallback: false,
      bookingProposal: null,
      intent: null,
      handoff: null,
    };
  }

  const historyPayload = conversationHistory.slice(-6).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  try {
    const invokeHeaders: Record<string, string> = { ...customHeaders };
    if (simulateQuota) {
      invokeHeaders['x-test-simulate-quota'] = 'true';
    }

    const invokePromise = supabase.functions.invoke('parish-assistant', {
      headers: invokeHeaders,
      body: {
        message: trimmedMessage,
        churchId: churchId || null,
        conversationHistory: historyPayload,
        bookingDraft: bookingDraft || null,
        simulateQuota,
      },
    });

    const timeoutPromise = new Promise<{
      data: null;
      error: { message: string };
    }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: null,
          error: { message: `Parish Assistant timed out after ${timeoutMs}ms` },
        });
      }, timeoutMs);
    });

    const result = await Promise.race([invokePromise, timeoutPromise]);
    const data = result.data as {
      reply?: string;
      sourcesUsed?: number;
      isRateLimited?: boolean;
      bookingProposal?: BookingProposal | null;
      intent?: ParishAssistantIntent | null;
      handoff?: ParishAssistantHandoff | null;
      debug?: AssistantDebugInfo | null;
    } | null;
    const fnError = result.error;

    if (!fnError && data?.reply) {
      return {
        reply: data.reply,
        sourcesUsed: typeof data.sourcesUsed === 'number' ? data.sourcesUsed : 0,
        isFallback: false,
        isRateLimited: Boolean(data.isRateLimited),
        bookingProposal: data.bookingProposal || null,
        intent: data.intent || null,
        handoff: data.handoff || null,
        debug: data.debug || null,
      };
    }

    if (fnError) {
      console.warn(
        'Edge function parish-assistant returned error, engaging keyword fallback:',
        fnError.message
      );
    }
  } catch (invokeErr: unknown) {
    console.warn(
      'Edge function parish-assistant invocation exception, engaging keyword fallback:',
      invokeErr
    );
  }

  // Graceful keyword fallback if edge function is unreachable or times out
  try {
    const fallback = await generateFallbackResponse(
      trimmedMessage,
      churchId,
      churchName
    );

    if (fallback && fallback.reply) {
      return {
        reply: fallback.reply,
        sourcesUsed: fallback.sourcesUsed,
        isFallback: true,
        bookingProposal: null,
        intent: null,
        handoff: null,
        debug: {
          model: 'keyword-fallback (offline database search)',
          isMock: false,
          turns: 0,
          tools: [],
        },
      };
    }
  } catch (fallbackErr) {
    console.warn('Keyword fallback lookup error:', fallbackErr);
  }

  // Last-resort parish contact fallback so parishioner is never stranded
  let parishContact = 'the parish office directly';
  if (churchId) {
    try {
      const { data: church } = await supabase
        .from('churches')
        .select('name, contact_number, email')
        .eq('id', churchId)
        .maybeSingle();

      if (church) {
        const contactDetail = church.contact_number || church.email;
        if (contactDetail) {
          parishContact = `${church.name || 'the parish'} at ${contactDetail}`;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    reply: `I am currently having trouble reaching the assistant service. For immediate assistance, please contact ${parishContact}.`,
    sourcesUsed: 0,
    isFallback: true,
    bookingProposal: null,
    intent: null,
    handoff: null,
  };
}
