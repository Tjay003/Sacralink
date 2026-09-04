import { supabase } from '../supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourcesUsed?: number;
  isFallback?: boolean;
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAIAssistantParams {
  churchId?: string | null;
  churchName?: string | null;
  message: string;
  conversationHistory?: ChatHistoryItem[];
  userId?: string | null;
}

export interface AIAssistantResponse {
  reply: string;
  sourcesUsed: number;
  isFallback: boolean;
}

/**
 * Audit log chat interaction to Supabase church_chat_logs table.
 * Gracefully swallows errors so chat UX remains uninterrupted even
 * when offline or experiencing RLS issues.
 */
export async function logChurchChat(entry: {
  userId?: string | null;
  churchId?: string | null;
  question: string;
  answer: string;
}): Promise<void> {
  try {
    let activeUserId = entry.userId;
    if (!activeUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      activeUserId = user?.id ?? null;
    }

    const payload: {
      question: string;
      answer: string;
      user_id?: string | null;
      church_id?: string | null;
    } = {
      question: entry.question.trim(),
      answer: entry.answer.trim(),
    };

    if (activeUserId) {
      payload.user_id = activeUserId;
    }
    if (entry.churchId) {
      payload.church_id = entry.churchId;
    }

    const { error } = await supabase.from('church_chat_logs').insert(payload);
    if (error) {
      console.warn('Audit log write error:', error.message);
    }
  } catch (err) {
    console.warn('Audit log write exception:', err);
  }
}

/**
 * Format 24-hour time to 12-hour AM/PM string.
 */
function formatTime12(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Structured fallback response generator when the Edge Function is offline,
 * hits rate-limits, or when performing general diocesan inquiries.
 */
async function generateFallbackResponse(
  message: string,
  churchId?: string | null,
  churchNameFallback?: string | null
): Promise<{ reply: string; sourcesUsed: number }> {
  const query = message.toLowerCase().trim();

  // 1. If we have a specific church context, fetch live DB entities
  if (churchId) {
    try {
      // Fetch basic church info
      const { data: church } = await supabase
        .from('churches')
        .select('name, address, contact_number, email, gcash_number, maya_number, description')
        .eq('id', churchId)
        .single();

      const churchName = church?.name || churchNameFallback || 'the parish';
      const contact = church?.contact_number || church?.email || 'the parish office';

      // A. Knowledge chunks keyword search
      const words = query
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      if (words.length > 0) {
        const orFilter = words.map((w) => `content.ilike.%${w}%`).join(',');
        const { data: chunks } = await supabase
          .from('church_knowledge_chunks')
          .select('content, source_type')
          .eq('church_id', churchId)
          .or(orFilter)
          .limit(3);

        if (chunks && chunks.length > 0) {
          const combined = chunks.map((c) => c.content).join('\n\n');
          return {
            reply: `Here is the information from **${churchName}** records:\n\n${combined}\n\n*For further inquiries, feel free to contact the parish office at ${contact}.*`,
            sourcesUsed: chunks.length,
          };
        }
      }

      // B. Mass schedules inquiry
      if (
        query.includes('mass') ||
        query.includes('misa') ||
        query.includes('schedule') ||
        query.includes('oras') ||
        query.includes('time')
      ) {
        const { data: schedules } = await supabase
          .from('mass_schedules')
          .select('day_of_week, time, time_start, language, celebrant')
          .eq('church_id', churchId);

        if (schedules && schedules.length > 0) {
          // Group by day
          const grouped: Record<string, string[]> = {};
          schedules.forEach((s) => {
            const day = s.day_of_week || 'Regular';
            if (!grouped[day]) grouped[day] = [];
            const timeFormatted = formatTime12(s.time || s.time_start);
            const lang = s.language ? ` (${s.language})` : '';
            grouped[day].push(`${timeFormatted}${lang}`);
          });

          const scheduleLines = Object.entries(grouped)
            .map(([day, times]) => `* **${day}:** ${times.join(', ')}`)
            .join('\n');

          return {
            reply: `Here are the official Mass schedules for **${churchName}**:\n\n${scheduleLines}\n\n*Please arrive 15 minutes before the liturgy begins. Confessions are usually heard before weekend Masses.*`,
            sourcesUsed: schedules.length,
          };
        }
      }

      // C. Sacrament requirements (Baptism, Wedding, Confirmation, etc.)
      if (
        query.includes('baptism') ||
        query.includes('binyag') ||
        query.includes('wedding') ||
        query.includes('kasal') ||
        query.includes('matrimon') ||
        query.includes('confirmation') ||
        query.includes('kumpil') ||
        query.includes('requirement') ||
        query.includes('document')
      ) {
        let serviceType = 'baptism';
        if (query.includes('wedding') || query.includes('kasal') || query.includes('matrimon')) {
          serviceType = 'wedding';
        } else if (query.includes('confirmation') || query.includes('kumpil')) {
          serviceType = 'confirmation';
        }

        const { data: reqs } = await supabase
          .from('sacrament_requirements')
          .select('requirement_name, description, is_required')
          .eq('church_id', churchId)
          .eq('service_type', serviceType)
          .order('display_order', { ascending: true });

        if (reqs && reqs.length > 0) {
          const reqLines = reqs
            .map(
              (r) =>
                `* **${r.requirement_name}**${r.is_required ? ' *(Required)*' : ''}${
                  r.description ? `: ${r.description}` : ''
                }`
            )
            .join('\n');

          const sacramentTitle =
            serviceType === 'baptism'
              ? 'Holy Baptism'
              : serviceType === 'wedding'
              ? 'Holy Matrimony'
              : 'Sacrament of Confirmation';

          return {
            reply: `Here are the requirements for **${sacramentTitle}** at **${churchName}**:\n\n${reqLines}\n\n*You can also initiate your booking directly on SacraLink or visit the parish office during regular hours.*`,
            sourcesUsed: reqs.length,
          };
        }
      }

      // D. Cashless donation / offerings
      if (
        query.includes('donate') ||
        query.includes('donation') ||
        query.includes('gcash') ||
        query.includes('maya') ||
        query.includes('cashless') ||
        query.includes('offering') ||
        query.includes('tithe')
      ) {
        const gcash = church?.gcash_number;
        const maya = church?.maya_number;

        let paymentText = '';
        if (gcash) paymentText += `* **GCash:** ${gcash}\n`;
        if (maya) paymentText += `* **Maya:** ${maya}\n`;

        return {
          reply: `You can support **${churchName}** through SacraLink's cashless giving:\n\n${
            paymentText || '* Cashless options are available on the Church Details screen in SacraLink.\n'
          }* Or directly visit the parish office.\n\n*May the Lord reward your generous stewardship! 🙏*`,
          sourcesUsed: 1,
        };
      }

      // Default church overview
      return {
        reply: `**${churchName}**\n\n* **Address:** ${church?.address || 'San Jose Del Monte Diocese'}\n* **Parish Contact:** ${contact}\n\nI can assist you with Mass schedules, sacrament requirements (Baptism, Wedding, Confirmation), appointments, and cashless donations. How may I help you today?`,
        sourcesUsed: 1,
      };
    } catch (err) {
      console.warn('Fallback DB lookup error:', err);
    }
  }

  // 2. General Diocesan Knowledge when no specific parish is selected
  if (query.includes('baptism') || query.includes('binyag')) {
    return {
      reply:
        '**General Diocesan Baptism Guidelines:**\n\n' +
        '* **Child’s PSA Birth Certificate** (original & photocopy)\n' +
        '* **Parents’ Catholic Marriage Certificate** (or civil marriage contract)\n' +
        '* **Godparents (Ninong/Ninang):** At least 16 years old, fully initiated Catholics (Baptized and Confirmed)\n' +
        '* **Pre-Jordan Catechetical Seminar:** Required for parents and godparents prior to the christening.\n\n' +
        '*Tip: Select your specific parish in the header selector to see parish-specific schedules and fees!*',
      sourcesUsed: 1,
    };
  }

  if (query.includes('wedding') || query.includes('kasal') || query.includes('matrimon')) {
    return {
      reply:
        '**General Diocesan Matrimony Requirements:**\n\n' +
        '* **Baptismal & Confirmation Certificates:** Issued within 6 months with the notation *"For Marriage Purposes"*\n' +
        '* **Certificate of No Marriage (CENOMAR)** from the PSA\n' +
        '* **Canonical Interview** with the parish priest\n' +
        '* **Pre-Cana Seminar** attendance certificate\n' +
        '* **Publication of Parish Banns** for 3 consecutive Sundays\n\n' +
        '*Book at least 3–6 months in advance through the church profile.*',
      sourcesUsed: 1,
    };
  }

  if (query.includes('donate') || query.includes('cashless') || query.includes('giving')) {
    return {
      reply:
        '**Cashless Donations via SacraLink:**\n\n' +
        '* Select any parish in the **Explore** tab.\n' +
        '* Tap the **"Donate / Tithe"** button to view official verified GCash and Maya QR codes.\n' +
        '* Digital donation receipts are logged securely under your parishioner profile.',
      sourcesUsed: 1,
    };
  }

  return {
    reply:
      'Peace be with you! 🙏 I am your **SacraLink Parish Assistant**.\n\n' +
      'I can answer questions regarding:\n' +
      '* **Holy Mass & Confession Schedules**\n' +
      '* **Sacrament Requirements** (Baptism, Wedding, Confirmation, Anointing)\n' +
      '* **Cashless Donations & Stewardship**\n' +
      '* **Parish Office Contact & Pastoral Services**\n\n' +
      '*Please ask a question or select a specific parish to view local details.*',
    sourcesUsed: 0,
  };
}

/**
 * Main AI Assistant query function.
 * Calls the Supabase Edge Function `church-ai-chat` and falls back
 * gracefully to structured diocesan/parish knowledge if unavailable.
 */
export async function askParishAIAssistant(
  params: AskAIAssistantParams
): Promise<AIAssistantResponse> {
  const { churchId, churchName, message, conversationHistory = [], userId } = params;

  // If a churchId is provided, try invoking the deployed edge function
  if (churchId) {
    try {
      const historyPayload = conversationHistory.slice(-6).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const { data, error: fnError } = await supabase.functions.invoke('church-ai-chat', {
        body: {
          churchId,
          message: message.trim(),
          conversationHistory: historyPayload,
        },
      });

      if (fnError) {
        let errorDetail = fnError.message;
        try {
          const parsed = await (fnError as any).context?.json?.();
          if (parsed?.error) errorDetail = parsed.error;
        } catch {
          // ignore parsing error
        }
        console.warn('Edge function church-ai-chat returned error, engaging fallback:', errorDetail);
      } else if (data?.reply) {
        // Successful edge function response
        const answer = String(data.reply).trim();
        const sourcesUsed = typeof data.sourcesUsed === 'number' ? data.sourcesUsed : 1;

        // Perform client audit logging as well
        await logChurchChat({
          userId,
          churchId,
          question: message,
          answer,
        });

        return {
          reply: answer,
          sourcesUsed,
          isFallback: false,
        };
      }
    } catch (edgeErr) {
      console.warn('Edge function invoke exception, activating fallback:', edgeErr);
    }
  }

  // Graceful Fallback
  const fallback = await generateFallbackResponse(message, churchId, churchName);

  // Log fallback answer to audit trail
  await logChurchChat({
    userId,
    churchId,
    question: message,
    answer: fallback.reply,
  });

  return {
    reply: fallback.reply,
    sourcesUsed: fallback.sourcesUsed,
    isFallback: true,
  };
}
