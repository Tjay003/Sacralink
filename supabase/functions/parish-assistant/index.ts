import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETRYABLE_STATUSES = new Set([429, 503, 529, 404]);

const tools = [
  {
    function_declarations: [
      {
        name: 'get_mass_schedule',
        description:
          'Get the recurring weekly Mass schedule for a parish or church. Returns day of week, time, and language.',
        parameters: {
          type: 'OBJECT',
          properties: {
            church_id: {
              type: 'STRING',
              description: 'The UUID of the church or parish',
            },
          },
          required: ['church_id'],
        },
      },
    ],
  },
];

async function executeTool(
  name: string,
  args: any,
  userClient: any,
  defaultChurchId?: string | null
): Promise<{ schedules?: any[]; error?: string }> {
  if (name === 'get_mass_schedule') {
    const targetChurchId = args?.church_id || defaultChurchId;
    if (!targetChurchId) {
      return { schedules: [], error: 'No church ID provided' };
    }

    const { data, error } = await userClient
      .from('mass_schedules')
      .select('id, day_of_week, time, language')
      .eq('church_id', targetChurchId)
      .order('day_of_week')
      .order('time');

    if (error) {
      console.error('get_mass_schedule query error:', error);
      return { schedules: [], error: error.message };
    }

    return { schedules: data || [] };
  }

  return { error: `Tool ${name} is not recognized` };
}

async function postToGemini(url: string, payload: any): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (url.includes('host.docker.internal')) {
      const fallbackUrl = url.replace('host.docker.internal', '127.0.0.1');
      return await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (url.includes('127.0.0.1')) {
      const fallbackUrl = url.replace('127.0.0.1', 'host.docker.internal');
      return await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. JWT verification strictly enforced: refuse unauthenticated calls
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: invalid or expired session token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || 'mock-key';
    const rawBaseUrl =
      Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com';
    const GEMINI_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

    const GEMINI_CHAT_MODELS = Deno.env.get('GEMINI_CHAT_MODELS')
      ? Deno.env.get('GEMINI_CHAT_MODELS')!
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ['gemini-2.5-flash', 'gemini-1.5-flash'];

    const body = await req.json();
    const { message, churchId, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'message string is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = `You are Sacralink's AI Parish Assistant, helping parishioners with Catholic parish schedules, sacrament inquiries, and bookings.
Current parish ID: ${churchId || 'none'}.
Always be warm, respectful, concise, and helpful.
When the user asks for Mass times or schedules, use the get_mass_schedule tool to retrieve live data. Never make up Mass times.
Format Mass schedules clearly with day of week, time, and language if available.`;

    const contents: any[] = [];
    const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];
    for (const turn of history) {
      if (turn.role && turn.content) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    let finalReply = '';
    let sourcesUsed = 0;
    const MAX_TOOL_TURNS = 5;

    for (const model of GEMINI_CHAT_MODELS) {
      try {
        let toolTurns = 0;
        const currentContents = JSON.parse(JSON.stringify(contents));

        while (toolTurns < MAX_TOOL_TURNS) {
          toolTurns++;
          const endpoint = `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
          const response = await postToGemini(endpoint, {
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: currentContents,
            tools,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 800,
            },
          });

          if (!response.ok) {
            const errText = await response.text();
            if (RETRYABLE_STATUSES.has(response.status)) {
              console.warn(`Model ${model} returned retryable ${response.status}: ${errText}`);
              break; // Try next model
            }
            throw new Error(`Gemini API error (${response.status}): ${errText}`);
          }

          const data = await response.json();
          const candidate = data.candidates?.[0];
          const part = candidate?.content?.parts?.[0];

          if (part?.functionCall) {
            const fnCall = part.functionCall;
            const toolResult = await executeTool(
              fnCall.name,
              fnCall.args,
              userClient,
              churchId
            );

            if (toolResult.schedules) {
              sourcesUsed += toolResult.schedules.length;
            }

            // Append model call turn
            currentContents.push({
              role: 'model',
              parts: [{ functionCall: fnCall }],
            });

            // Append user tool response turn
            currentContents.push({
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: fnCall.name,
                    response: toolResult,
                  },
                },
              ],
            });

            continue;
          }

          // Text reply reached
          finalReply =
            part?.text ||
            candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') ||
            '';
          break;
        }

        if (finalReply) {
          break;
        }
      } catch (modelErr: any) {
        console.error(`Model ${model} iteration error:`, modelErr.message);
      }
    }

    if (!finalReply) {
      finalReply =
        "I'm sorry, I couldn't retrieve the parish schedules at this moment. Please try again shortly or contact the parish office.";
    }

    // Log exchange once to church_chat_logs using service role client
    try {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await serviceClient.from('church_chat_logs').insert({
        church_id: churchId || null,
        user_id: user.id,
        question: message,
        answer: finalReply,
      });
    } catch (logErr) {
      console.error('Failed to log assistant exchange:', logErr);
    }

    // Response contract
    return new Response(
      JSON.stringify({
        reply: finalReply,
        sourcesUsed,
        bookingProposal: null,
        intent: null,
        handoff: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('parish-assistant runtime error:', err.message);
    return new Response(
      JSON.stringify({
        error: err.message,
        reply:
          "I'm sorry, something went wrong while processing your request. Please try again in a few minutes.",
        sourcesUsed: 0,
        bookingProposal: null,
        intent: null,
        handoff: null,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
