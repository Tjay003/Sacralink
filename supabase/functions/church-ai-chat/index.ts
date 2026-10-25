import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Errors worth retrying with the next model
const RETRYABLE_STATUSES = new Set([429, 503, 529, 404]);

// Try models in order, falling back on quota / overload errors
const CHAT_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

// Only pass last N turns to keep prompt small
const MAX_HISTORY_TURNS = 6;

async function generateReply(
  systemInstruction: string,
  history: any[],
  userMessage: string,
  apiKey: string
): Promise<string> {
  const errors: string[] = [];

  for (const model of CHAT_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.1,      // Lowered from 0.3 → more factual, less creative
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text
        ?? "I'm sorry, I couldn't generate a response. Please try again.";
    }

    const errBody = await response.text();
    errors.push(`${model}(${response.status})`);
    console.error(`Model ${model} failed with ${response.status}:`, errBody.substring(0, 200));

    if (!RETRYABLE_STATUSES.has(response.status)) {
      throw new Error(`Gemini chat error (${response.status}) on ${model}: ${errBody}`);
    }

    // Brief backoff before trying next model
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(
    `All Gemini models are temporarily unavailable (${errors.join(', ')}). Please try again in a few minutes.`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEYS');
    const GEMINI_API_KEY = rawKey?.split(',')[0]?.trim();
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

    const body = await req.json();
    const { churchId, message, conversationHistory } = body;

    if (!churchId || !message) {
      return new Response(
        JSON.stringify({ error: 'churchId and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional auth for logging
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        userId = user?.id ?? null;
      } catch { /* not logged in */ }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Embed question
    const embedResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: message }] },
          outputDimensionality: 768,
        }),
      }
    );

    if (!embedResponse.ok) {
      const err = await embedResponse.text();
      throw new Error(`Gemini embedding error (${embedResponse.status}): ${err}`);
    }

    const embedData = await embedResponse.json();
    const queryEmbedding: number[] = embedData.embedding.values;

    // Step 2: Vector search — increased to 8 chunks for better recall
    const { data: chunks, error: searchError } = await supabase.rpc('match_church_knowledge', {
      query_embedding: queryEmbedding,
      match_church_id: churchId,
      match_count: 8,
    });
    if (searchError) console.error('Vector search error:', JSON.stringify(searchError));

    // Step 3: Church info
    const { data: churchData } = await supabase
      .from('churches').select('name, contact_number, email').eq('id', churchId).single();

    const churchName = churchData?.name || 'the parish';
    const churchContact = churchData?.contact_number || churchData?.email || 'the church office';
    const contextChunks = (chunks || []).map((c: any) => c.content).join('\n\n');
    const sourcesUsed = (chunks || []).length;

    // Step 4: Build system prompt
    const systemInstruction = `You are a helpful, multilingual parish assistant for ${churchName}.

LANGUAGE RULES (strictly follow these):
- Detect the language the user is writing in.
- If the user writes in English → reply entirely in English.
- If the user writes in Filipino or Tagalog → reply entirely in Filipino/Tagalog.
- If the user mixes both languages → reply in Filipino/Tagalog.
- Always use formal, respectful language appropriate for a Catholic parish.
- Do NOT switch languages mid-reply.

SCOPE RULES (strictly follow these):
- You ONLY answer questions related to this parish: sacraments, schedules, requirements, announcements, ministries, facilities, and church information.
- If the user asks something completely unrelated to the parish, politely decline and redirect: "I can only help with parish-related questions. Is there something about ${churchName} I can help you with?"
- Do NOT answer unrelated questions even if you know the answer.

ANSWERING RULES:
- Answer ONLY using the information in the CHURCH KNOWLEDGE section below.
- Never infer, guess, or make up details not explicitly in the knowledge base.
- If the answer is not found in the knowledge base, say: "I'm sorry, I don't have that information. Please contact the church office at ${churchContact}" (in the user's language).
- Be concise. For yes/no questions, answer in one sentence first, then expand if needed.
- For schedules or lists, use bullet points for clarity.
- Keep replies under 200 words unless a detailed explanation is truly necessary.

--- CHURCH KNOWLEDGE ---
${contextChunks || 'No church information synced yet. Ask an administrator to sync the knowledge base.'}
--- END KNOWLEDGE ---`;

    // Step 5: Trim conversation history to last MAX_HISTORY_TURNS messages
    const rawHistory = (conversationHistory || []);
    const trimmedHistory = rawHistory.slice(-MAX_HISTORY_TURNS);
    const geminiHistory = trimmedHistory.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Step 6: Generate reply with full model fallback chain
    const reply = await generateReply(systemInstruction, geminiHistory, message, GEMINI_API_KEY);

    // Step 7: Log if authenticated
    if (userId) {
      supabase.from('church_chat_logs').insert({
        church_id: churchId, user_id: userId, question: message, answer: reply,
      }).then(() => {}).catch(console.error);
    }

    return new Response(
      JSON.stringify({ reply, sourcesUsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('church-ai-chat error:', err.message);

    const isOverload = err.message?.toLowerCase().includes('unavailable') ||
                       err.message?.includes('503') ||
                       err.message?.includes('high demand');

    const userMessage = isOverload
      ? "The AI assistant is temporarily busy due to high demand. Please try again in a minute."
      : "I'm sorry, something went wrong. Please try again shortly.";

    return new Response(
      JSON.stringify({ error: err.message, reply: userMessage }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
