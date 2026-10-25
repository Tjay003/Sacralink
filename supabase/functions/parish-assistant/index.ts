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
      {
        name: 'list_parishes',
        description: 'List all active Catholic parishes or churches in the diocese.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'find_mass_across_parishes',
        description:
          'Find Mass schedules across all active parishes by day of the week and optional time.',
        parameters: {
          type: 'OBJECT',
          properties: {
            day_of_week: {
              type: 'STRING',
              description: 'Day of week, e.g. Sunday, Saturday, Monday',
            },
            time: {
              type: 'STRING',
              description: 'Optional time of day, e.g. 18:00 or 6:00 PM',
            },
          },
          required: ['day_of_week'],
        },
      },
      {
        name: 'get_bookable_services',
        description:
          'Get the list of active bookable sacramental services offered by a parish.',
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
      {
        name: 'get_sacrament_requirements',
        description:
          'Get the document requirements and guidelines for a sacramental service at a parish.',
        parameters: {
          type: 'OBJECT',
          properties: {
            church_id: {
              type: 'STRING',
              description: 'The UUID of the church or parish',
            },
            service_name: {
              type: 'STRING',
              description: 'The sacrament or service name, e.g. Baptism, Wedding, Confirmation',
            },
          },
          required: ['church_id', 'service_name'],
        },
      },
      {
        name: 'check_slot_availability',
        description:
          'Check whether a date and time slot is available for an appointment at a parish.',
        parameters: {
          type: 'OBJECT',
          properties: {
            church_id: {
              type: 'STRING',
              description: 'The UUID of the church or parish',
            },
            date: {
              type: 'STRING',
              description: 'The date in YYYY-MM-DD format',
            },
            time: {
              type: 'STRING',
              description: 'The time in HH:MM format (24-hour)',
            },
          },
          required: ['church_id', 'date', 'time'],
        },
      },
      {
        name: 'check_priest_availability',
        description:
          'Check whether a priest is available on a given date and optional time. Never returns or exposes private leave reasons. Returns only availability status (yes/no).',
        parameters: {
          type: 'OBJECT',
          properties: {
            church_id: {
              type: 'STRING',
              description: 'Optional UUID of the parish',
            },
            priest_name: {
              type: 'STRING',
              description: 'Name of the priest, e.g. Father John',
            },
            priest_id: {
              type: 'STRING',
              description: 'Optional UUID of the priest',
            },
            date: {
              type: 'STRING',
              description: 'The date in YYYY-MM-DD format or day of week',
            },
            time: {
              type: 'STRING',
              description: 'Optional time in HH:MM format',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'get_my_appointments',
        description:
          "Get the authenticated caller's own appointments with schedule, service, status, and any rescheduling details. Protected by Row Level Security.",
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'search_church_knowledge',
        description:
          'Search parish knowledge sections and announcements for general information about ministries, facilities, history, or office hours.',
        parameters: {
          type: 'OBJECT',
          properties: {
            church_id: {
              type: 'STRING',
              description: 'The UUID of the church or parish',
            },
            query: {
              type: 'STRING',
              description: 'Free-text search query',
            },
          },
          required: ['church_id', 'query'],
        },
      },
    ],
  },
];

interface ToolExecutionResult {
  schedules?: any[];
  parishes?: any[];
  services?: any[];
  requirements?: any[];
  appointments?: any[];
  results?: any[];
  available?: boolean;
  slot_taken?: boolean;
  has_eligible_priest?: boolean;
  error?: string;
}

async function executeTool(
  name: string,
  args: any,
  userClient: any,
  defaultChurchId?: string | null,
  context?: {
    geminiBaseUrl?: string;
    geminiApiKey?: string;
    serviceClient?: any;
  }
): Promise<ToolExecutionResult> {
  const targetChurchId = args?.church_id || defaultChurchId;

  // 1. get_mass_schedule
  if (name === 'get_mass_schedule') {
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
      console.error('get_mass_schedule error:', error);
      return { schedules: [], error: error.message };
    }

    return { schedules: data || [] };
  }

  // 2. list_parishes
  if (name === 'list_parishes') {
    const { data, error } = await userClient
      .from('churches')
      .select('id, name, address, contact_number, email')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('list_parishes error:', error);
      return { parishes: [], error: error.message };
    }

    return { parishes: data || [] };
  }

  // 3. find_mass_across_parishes
  if (name === 'find_mass_across_parishes') {
    const dayOfWeek = args?.day_of_week;
    if (!dayOfWeek) {
      return { schedules: [], error: 'day_of_week is required' };
    }

    const { data, error } = await userClient
      .from('mass_schedules')
      .select(`
        id,
        day_of_week,
        time,
        language,
        church:churches!inner(id, name, address, is_active)
      `)
      .eq('church.is_active', true)
      .ilike('day_of_week', dayOfWeek.trim())
      .order('time');

    if (error) {
      console.error('find_mass_across_parishes error:', error);
      return { schedules: [], error: error.message };
    }

    let schedules = data || [];
    if (args?.time) {
      const rawTime = String(args.time).trim();
      const match = rawTime.match(/\b(\d{1,2}:\d{2})/);
      if (match) {
        const prefix = match[1].padStart(5, '0');
        const filtered = schedules.filter((s: any) => s.time?.startsWith(prefix));
        if (filtered.length > 0) {
          schedules = filtered;
        }
      }
    }

    return { schedules };
  }

  // 4. get_bookable_services
  if (name === 'get_bookable_services') {
    if (!targetChurchId) {
      return { services: [], error: 'No church ID provided' };
    }

    const { data, error } = await userClient
      .from('church_service_types')
      .select('id, name, description, kind, display_order')
      .eq('church_id', targetChurchId)
      .eq('is_hidden', false)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('get_bookable_services error:', error);
      return { services: [], error: error.message };
    }

    return { services: data || [] };
  }

  // 5. get_sacrament_requirements
  if (name === 'get_sacrament_requirements') {
    if (!targetChurchId) {
      return { requirements: [], error: 'No church ID provided' };
    }
    const serviceName = (args?.service_name || '').trim();

    let serviceTypeId: string | null = null;
    if (serviceName) {
      const { data: services } = await userClient
        .from('church_service_types')
        .select('id, name, kind')
        .eq('church_id', targetChurchId)
        .is('deleted_at', null);

      const matchedService = (services || []).find(
        (s: any) =>
          s.name.toLowerCase() === serviceName.toLowerCase() ||
          (s.kind && s.kind.toLowerCase() === serviceName.toLowerCase()) ||
          s.name.toLowerCase().includes(serviceName.toLowerCase())
      );
      if (matchedService) {
        serviceTypeId = matchedService.id;
      }
    }

    let query = userClient
      .from('sacrament_requirements')
      .select('id, requirement_name, description, is_required, allowed_file_types, display_order')
      .eq('church_id', targetChurchId);

    if (serviceTypeId) {
      query = query.eq('service_type_id', serviceTypeId);
    } else if (serviceName) {
      query = query.ilike('service_type', `%${serviceName}%`);
    }

    const { data, error } = await query.order('display_order', { ascending: true });
    if (error) {
      console.error('get_sacrament_requirements error:', error);
      return { requirements: [], error: error.message };
    }

    return { requirements: data || [] };
  }

  // 6. check_slot_availability
  if (name === 'check_slot_availability') {
    if (!targetChurchId || !args?.date || !args?.time) {
      return { available: false, error: 'church_id, date, and time are required' };
    }

    const cleanDate = args.date.includes('T') ? args.date.split('T')[0] : args.date.trim();
    const cleanTime = args.time.trim();

    const { data, error } = await userClient.rpc('check_parish_slot', {
      p_church_id: targetChurchId,
      p_date: cleanDate,
      p_time: cleanTime,
    });

    if (error) {
      console.error('check_parish_slot error:', error);
      return { available: false, error: error.message };
    }

    const row = data?.[0];
    const slotTaken = Boolean(row?.slot_taken);
    const hasEligiblePriest = Boolean(row?.has_eligible_priest);
    const isAvailable = !slotTaken && hasEligiblePriest;

    return {
      available: isAvailable,
      slot_taken: slotTaken,
      has_eligible_priest: hasEligiblePriest,
    };
  }

  // 7. check_priest_availability
  // MANDATORY PRIVACY RULE: Never select, inspect, or return priest leave or blackout reason.
  // Returns { available: boolean } ONLY.
  if (name === 'check_priest_availability') {
    try {
      let priestId = args?.priest_id;

      if (!priestId && args?.priest_name) {
        const cleanName = String(args.priest_name)
          .replace(/^(fr\.|father|rev\.|rev|padre)\s+/i, '')
          .trim();

        let profileQuery = userClient
          .from('profiles')
          .select('id, full_name, church_id, assigned_church_id')
          .or('is_priest.eq.true,role.eq.priest');

        if (cleanName) {
          profileQuery = profileQuery.ilike('full_name', `%${cleanName}%`);
        }

        const { data: candidates, error: pErr } = await profileQuery;
        if (pErr) {
          console.error('Error resolving priest profile:', pErr);
        }

        if (candidates && candidates.length > 0) {
          const matched =
            candidates.find(
              (c: any) =>
                c.church_id === targetChurchId || c.assigned_church_id === targetChurchId
            ) || candidates[0];
          priestId = matched.id;
        }
      }

      if (!priestId) {
        return { available: false };
      }

      const rawDate = (args?.date || '').trim();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      let dayOfWeek: number | null = null;
      let calendarDate: string | null = null;

      if (dayNames.includes(rawDate.toLowerCase())) {
        dayOfWeek = dayNames.indexOf(rawDate.toLowerCase());
      } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        calendarDate = rawDate.split('T')[0];
        const [y, m, d] = calendarDate.split('-').map(Number);
        dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      }

      // CRITICAL PRIVACY BOUNDARY: We do NOT select 'reason' or 'notes' column.
      const { data: records, error: availErr } = await userClient
        .from('priest_availability')
        .select('day_of_week, blackout_start, blackout_end, is_blocked, available_date')
        .eq('priest_id', priestId);

      if (availErr) {
        console.error('Error fetching priest availability:', availErr);
        return { available: false };
      }

      const allRecords = records || [];

      // Check recurring day off
      if (dayOfWeek !== null) {
        const isDayOff = allRecords.some((r: any) => r.day_of_week === dayOfWeek);
        if (isDayOff) {
          return { available: false };
        }
      }

      // Check blackout dates
      if (calendarDate) {
        const isBlackout = allRecords.some((r: any) => {
          if (!r.blackout_start || !r.blackout_end) return false;
          return calendarDate! >= r.blackout_start && calendarDate! <= r.blackout_end;
        });
        if (isBlackout) {
          return { available: false };
        }

        const isBlocked = allRecords.some(
          (r: any) => r.available_date === calendarDate && r.is_blocked === true
        );
        if (isBlocked) {
          return { available: false };
        }
      }

      // Check appointment clashes
      if (calendarDate && args?.time) {
        const cleanTime = String(args.time).trim();
        const { data: collisions } = await userClient
          .from('appointments')
          .select('id, appointment_time')
          .eq('priest_id', priestId)
          .eq('appointment_date', calendarDate)
          .not('status', 'in', '("cancelled","rejected")');

        if (collisions && collisions.length > 0) {
          const hasClash = collisions.some((a: any) => {
            if (!a.appointment_time) return false;
            return a.appointment_time.slice(0, 5) === cleanTime.slice(0, 5);
          });
          if (hasClash) {
            return { available: false };
          }
        }
      }

      return { available: true };
    } catch (err) {
      console.error('Exception checking priest availability:', err);
      return { available: false };
    }
  }

  // 8. get_my_appointments
  // Executed with userClient; RLS restricts results strictly to auth.uid().
  if (name === 'get_my_appointments') {
    const { data, error } = await userClient
      .from('appointments')
      .select(`
        id,
        service_type,
        appointment_date,
        appointment_time,
        status,
        notes,
        rescheduled_from_date,
        reschedule_reason,
        church:churches(id, name)
      `)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (error) {
      console.error('get_my_appointments error:', error);
      return { appointments: [], error: error.message };
    }

    return { appointments: data || [] };
  }

  // 9. search_church_knowledge
  if (name === 'search_church_knowledge') {
    if (!targetChurchId) {
      return { results: [], error: 'No church ID provided' };
    }
    const query = (args?.query || '').trim();
    let results: any[] = [];

    // Try vector search if valid Gemini API key is configured
    if (
      context?.geminiApiKey &&
      context.geminiApiKey !== 'mock-key' &&
      context?.geminiBaseUrl
    ) {
      try {
        const embedRes = await fetch(
          `${context.geminiBaseUrl}/v1beta/models/gemini-embedding-001:embedContent?key=${context.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: query }] },
              outputDimensionality: 768,
            }),
          }
        );
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const embedding = embedData.embedding?.values;
          if (embedding) {
            let { data: chunks, error: rpcErr } = await userClient.rpc(
              'match_church_knowledge',
              {
                query_embedding: embedding,
                match_church_id: targetChurchId,
                match_count: 5,
              }
            );
            if (rpcErr && context.serviceClient) {
              const { data: svcChunks } = await context.serviceClient.rpc(
                'match_church_knowledge',
                {
                  query_embedding: embedding,
                  match_church_id: targetChurchId,
                  match_count: 5,
                }
              );
              chunks = svcChunks;
            }
            if (chunks && chunks.length > 0) {
              results = chunks.map((c: any) => ({
                content: c.content,
                similarity: c.similarity,
              }));
            }
          }
        }
      } catch (err) {
        console.warn('Vector search exception, falling back to sections:', err);
      }
    }

    // Fallback: search church_announcements, announcements, church details, and sections
    if (results.length === 0) {
      // 1. Search church_announcements
      try {
        const { data: churchAnnouncements } = await userClient
          .from('church_announcements')
          .select('title, content')
          .eq('church_id', targetChurchId)
          .limit(5);

        if (churchAnnouncements && churchAnnouncements.length > 0) {
          for (const ann of churchAnnouncements) {
            results.push({ title: ann.title, content: ann.content });
          }
        }
      } catch {
        // Table might not exist or error
      }

      // 2. Search announcements
      try {
        const { data: generalAnnouncements } = await userClient
          .from('announcements')
          .select('title, body')
          .eq('church_id', targetChurchId)
          .eq('is_active', true)
          .limit(5);

        if (generalAnnouncements && generalAnnouncements.length > 0) {
          for (const ann of generalAnnouncements) {
            results.push({ title: ann.title, content: ann.body });
          }
        }
      } catch {
        // ignore
      }

      // 3. Search church_knowledge_sections if present
      try {
        const { data: sections } = await userClient
          .from('church_knowledge_sections')
          .select('id, title, content')
          .eq('church_id', targetChurchId)
          .limit(5);

        if (sections && sections.length > 0) {
          for (const sec of sections) {
            results.push({ title: sec.title, content: sec.content });
          }
        }
      } catch {
        // ignore
      }

      // 4. Search church profile description & operating hours
      if (results.length === 0) {
        try {
          const { data: church } = await userClient
            .from('churches')
            .select('name, address, description, contact_number, email, operating_hours')
            .eq('id', targetChurchId)
            .maybeSingle();

          if (church) {
            if (church.description) {
              results.push({ title: 'About the Parish', content: church.description });
            }
            if (church.operating_hours) {
              const hours =
                typeof church.operating_hours === 'string'
                  ? church.operating_hours
                  : JSON.stringify(church.operating_hours);
              results.push({ title: 'Operating Hours', content: hours });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return { results };
  }

  return { error: `Tool ${name} is not recognized` };
}

let activeGeminiKeyIndex = 0;

function parseGeminiKeys(): string[] {
  const keys = (Deno.env.get('GEMINI_API_KEYS') || Deno.env.get('GEMINI_API_KEY') || 'mock-key')
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);
  return keys.length > 0 ? keys : ['mock-key'];
}

function getActiveGeminiKey(keys: string[]): string {
  if (keys.length === 0) return 'mock-key';
  return keys[activeGeminiKeyIndex % keys.length];
}

function rotateGeminiKey(keys: string[]): string {
  if (keys.length <= 1) return keys[0] || 'mock-key';
  const prevIndex = activeGeminiKeyIndex % keys.length;
  activeGeminiKeyIndex = (activeGeminiKeyIndex + 1) % keys.length;
  console.warn(`Gemini API key index ${prevIndex} rate-limited (429). Rotating to key index ${activeGeminiKeyIndex}...`);
  return keys[activeGeminiKeyIndex];
}

async function postToGemini(
  url: string,
  payload: any,
  customHeaders: Record<string, string> = {}
): Promise<Response> {
  const reqHeaders = { 'Content-Type': 'application/json', ...customHeaders };
  try {
    return await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (url.includes('host.docker.internal')) {
      const fallbackUrl = url.replace('host.docker.internal', '127.0.0.1');
      return await fetch(fallbackUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload),
      });
    }
    if (url.includes('127.0.0.1')) {
      const fallbackUrl = url.replace('127.0.0.1', 'host.docker.internal');
      return await fetch(fallbackUrl, {
        method: 'POST',
        headers: reqHeaders,
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

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    // AI Scribe Action for Knowledge Base Polishing
    if (body.action === 'polish_knowledge') {
      const startTime = Date.now();
      const { title = '', content = '', churchName = '' } = body;
      if (!content || typeof content !== 'string') {
        return new Response(
          JSON.stringify({ error: 'content string is required for polishing' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const geminiKeys = parseGeminiKeys();
      const rawBaseUrl =
        Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com';
      const GEMINI_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

      const GEMINI_CHAT_MODELS = Deno.env.get('GEMINI_CHAT_MODELS')
        ? Deno.env.get('GEMINI_CHAT_MODELS')!
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.8-flash'];

      const geminiHeaders: Record<string, string> = {};
      const testSimulateQuota = req.headers.get('x-test-simulate-quota');
      if (testSimulateQuota) {
        geminiHeaders['x-test-simulate-quota'] = testSimulateQuota;
      }
      const testSimulateKeyQuota =
        req.headers.get('x-test-simulate-key-quota') ||
        req.headers.get('x-test-simulate-quota-key');
      if (testSimulateKeyQuota) {
        geminiHeaders['x-test-simulate-key-quota'] = testSimulateKeyQuota;
      }

      const polishSystemInstruction = `You are a Catholic parish pastoral communications director in the Philippines.
Your mission is to transform raw admin notes, shorthand notes, and rough bullet points into warm, welcoming, reverent, and clear parish guidelines and policies for Catholic parishioners.
Context:
Parish/Church Name: ${churchName || 'Catholic Parish'}
Title: ${title || 'Parish Guidelines'}

RULES:
1. Tone: Warm, welcoming, reverent, respectful, and clear pastoral tone.
2. Faithfulness: Preserve all factual rules, timeframes, document requirements, and restrictions faithfully. Never invent new obligations, fees, or requirements.
3. Formatting: Format with clear markdown headings (###, ####), bulleted lists, and respectful language.
4. Output Requirement: Return ONLY a valid JSON object with keys "polishedTitle" and "polishedContent". No other commentary.
Format:
{
  "polishedTitle": "<refined title>",
  "polishedContent": "<refined pastoral markdown content>"
}`;

      const polishUserPrompt = `Please polish the following parish policy notes into dignified Catholic parish guidelines:

Draft Title: ${title || 'Untitled'}
Draft Content:
${content}

Return ONLY valid JSON matching:
{
  "polishedTitle": "...",
  "polishedContent": "..."
}`;

      let polishedTitle = title ? title.trim() : 'Parish Guidelines';
      let polishedContent = '';
      let geminiSuccess = false;
      let activeModelName = '';

      for (const model of GEMINI_CHAT_MODELS) {
        let keysAttempted = 0;
        const maxKeyAttempts = Math.max(1, geminiKeys.length);
        while (keysAttempted < maxKeyAttempts) {
          try {
            const currentApiKey = getActiveGeminiKey(geminiKeys);
            const endpoint = `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
            const response = await postToGemini(endpoint, {
              system_instruction: { parts: [{ text: polishSystemInstruction }] },
              contents: [{ role: 'user', parts: [{ text: polishUserPrompt }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1200,
              },
            }, geminiHeaders);

            if (response.status === 429 && geminiKeys.length > 1 && keysAttempted < maxKeyAttempts - 1) {
              console.warn(`Model ${model} returned 429 on polish with key index ${activeGeminiKeyIndex % geminiKeys.length}. Rotating key...`);
              rotateGeminiKey(geminiKeys);
              keysAttempted++;
              continue;
            }

            if (!response.ok) {
              break;
            }

            const respData = await response.json();
            const candidateText = respData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              try {
                const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                const parsed = JSON.parse(cleanJson);
                if (parsed.polishedContent) {
                  polishedTitle = parsed.polishedTitle || title || 'Parish Guidelines';
                  polishedContent = parsed.polishedContent;
                  geminiSuccess = true;
                  activeModelName = model;
                  break;
                }
              } catch {
                polishedContent = candidateText;
                geminiSuccess = true;
                activeModelName = model;
                break;
              }
            }
            break;
          } catch {
            // Model error, continue to next model
            break;
          }
        }
        if (geminiSuccess) break;
      }

      if (!geminiSuccess || !polishedContent) {
        // Fallback cleanup
        polishedTitle = title ? title.trim() : 'Parish Guidelines';
        const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const bullets = lines.map((l: string) => {
          const stripped = l.replace(/^[-*•\d.]\s*/, '').trim();
          return `• ${stripped.charAt(0).toUpperCase() + stripped.slice(1)}`;
        }).join('\n');

        polishedContent = `### Liturgical Decorum & Guidelines\n\nTo preserve the sacredness of our parish celebrations and ensure a prayerful experience for all worshippers, we kindly invite all parishioners to observe the following pastoral guidelines:\n\n${bullets || '• Please observe all standard parish guidelines and liturgical decorum.'}\n\n*For further inquiries, sacramental verification, or pastoral guidance, please visit or contact the parish office.*`;
      }

      return new Response(
        JSON.stringify({
          success: true,
          polishedTitle,
          polishedContent,
          model: activeModelName || 'gemini-3.8-flash',
          durationMs: Math.round(Date.now() - startTime),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, churchId, conversationHistory, simulateQuota, bookingDraft } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'message string is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Server Rate Limiter: at most 10 assistant messages per user per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount, error: countErr } = await serviceClient
      .from('church_chat_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', fiveMinutesAgo);

    if (!countErr && typeof recentCount === 'number' && recentCount >= 10) {
      return new Response(
        JSON.stringify({
          isRateLimited: true,
          reply:
            'You have reached the temporary inquiry limit. Please wait a few minutes or contact the parish office directly for immediate assistance.',
          sourcesUsed: 0,
          bookingProposal: null,
          intent: null,
          handoff: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiKeys = parseGeminiKeys();
    const rawBaseUrl =
      Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com';
    const GEMINI_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

    const GEMINI_CHAT_MODELS = Deno.env.get('GEMINI_CHAT_MODELS')
      ? Deno.env.get('GEMINI_CHAT_MODELS')!
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.8-flash'];

    const geminiHeaders: Record<string, string> = {};
    const testSimulateQuota =
      req.headers.get('x-test-simulate-quota') ||
      (simulateQuota ? 'true' : null);
    if (testSimulateQuota) {
      geminiHeaders['x-test-simulate-quota'] = testSimulateQuota;
    }
    const testSimulateKeyQuota =
      req.headers.get('x-test-simulate-key-quota') ||
      req.headers.get('x-test-simulate-quota-key');
    if (testSimulateKeyQuota) {
      geminiHeaders['x-test-simulate-key-quota'] = testSimulateKeyQuota;
    }

    let bookingContext = '';
    if (bookingDraft) {
      const currentStep = bookingDraft.currentStep || bookingDraft.step || 'none';
      const serviceName = bookingDraft.serviceTypeName || 'none';
      const apptDate = bookingDraft.appointmentDate || bookingDraft.date || 'none';
      const apptTime = bookingDraft.appointmentTime || bookingDraft.time || 'none';
      const priest = bookingDraft.requestedPriestName || 'none';
      const notes = bookingDraft.notes || 'none';
      bookingContext = `\nACTIVE BOOKING DRAFT IN PROGRESS:
- Current Step: ${currentStep}
- Selected Service: ${serviceName}
- Date: ${apptDate}
- Time: ${apptTime}
- Requested Priest: ${priest}
- Notes: ${notes}\n`;
    }

    const systemInstruction = `You are Sacralink's AI Parish Assistant, helping parishioners with Catholic parish schedules, sacrament inquiries, requirements, and bookings.
Current parish ID: ${churchId || 'none'}.
${bookingContext}
RULES & GUIDELINES:
1. TOOL USE & PRECEDENCE:
   - Hierarchy of truth (Single Source of Truth - SSOT):
     1. Live Database Tools (get_mass_schedule, find_mass_across_parishes, get_bookable_services, check_slot_availability, check_priest_availability, get_my_appointments, get_sacrament_requirements) are the authoritative Single Source of Truth (SSOT) for all live schedules, services, availability, and bookings.
     2. Knowledge Base Search (search_church_knowledge) is authoritative ONLY for unstructured parish policies, history, dress codes, fiesta schedules, office guidelines, and FAQs.
     3. Discrepancy Resolution: In any case of discrepancy between knowledge base chunks and live database tool outputs (e.g., if a knowledge note mentions an old Mass time or outdated service fee), the live tool output MUST ALWAYS supersede and be communicated as the true current policy. Never blend or mention outdated vector information when live tool data is available.
   - Always prioritize live read tools for structured questions:
     * Mass schedules: get_mass_schedule (for current parish) or find_mass_across_parishes (across diocese by day/time)
     * Bookable services: get_bookable_services (using the parish's own custom service names)
     * Sacrament requirements: get_sacrament_requirements
     * Slot availability: check_slot_availability
     * Priest availability: check_priest_availability
     * User's own appointments: get_my_appointments
   - Use search_church_knowledge for free-text parish information (announcements, ministries, facilities, history, office hours, dress codes, guidelines).
2. PRIEST AVAILABILITY:
   - When asked if a priest is available, answer with a clear yes or no only.
   - NEVER disclose, speculate, or inquire about why a priest is unavailable.
3. LANGUAGE & TONE:
   - Detect the language of the user: English, Tagalog, or Taglish.
   - If user writes in Tagalog or Taglish, reply in respectful Tagalog (Po/Opo).
   - If user writes in English, reply in respectful English.
   - Be formal, concise, and helpful. Use bulleted lists for schedules, documents, and requirements.
4. SCOPE & HONESTY:
   - Only answer Catholic parish-related questions.
   - Never invent or assume details. If an answer cannot be found in the live tools or knowledge base, clearly say so and advise contacting the parish office.
5. GUIDED BOOKING & INTENTS:
   - When the user expresses intent to book or schedule a sacrament or service (e.g. "I want to book a baptism", "mag-book ng binyag", "schedule a wedding"):
     * Identify the sacrament or service if named.
     * Include a JSON code block with the booking intent:
       \`\`\`json
       {
         "intent": { "type": "start_booking", "serviceName": "<SacramentName>" }
       }
       \`\`\`
   - When an active booking draft is in progress:
     * Current step and existing draft fields are provided in the context above.
     * When the user types an answer for the current field (e.g. a date like "next Saturday morning", or a time like "10:00 AM", or notes):
       Parse and propose the field value in standard format (YYYY-MM-DD for date, HH:MM for time):
       \`\`\`json
       {
         "bookingProposal": { "field": "<date|time|notes>", "value": "<parsed_value>" }
       }
       \`\`\`
     * When the user asks to change an earlier step ("change the date", "palitan ang petsa", "change time"):
       Return:
       \`\`\`json
       {
         "intent": { "type": "change_step", "step": "<service|date|time|priest|notes>" }
       }
       \`\`\`
     * When the user asks a side question mid-booking (e.g. "what's a Pre-Jordan seminar?"), answer the question clearly using tools or knowledge without resetting the booking session.
6. PARISH OFFICE TICKETS & INTENTS:
   - When the user asks to talk to the parish office (e.g. "I want to talk to the parish office", "Gusto kong makausap ang parish office", "Talk to the parish office"), or when you cannot answer an inquiry and offer to send it to the parish office:
     Return a ticket drafting intent with category, subject, and drafted message:
     \`\`\`json
     {
       "intent": {
         "type": "draft_ticket",
         "category": "<general|baptism|wedding|funeral|mass_intention|certificate>",
         "subject": "<Concise subject summary>",
         "message": "<Drafted inquiry message based on conversation>"
       }
     }
     \`\`\`
7. HAND-OFF ACTIONS:
   - When the user asks to cancel, reschedule, or modify an existing appointment (e.g. "Cancel my wedding booking", "Reschedule my baptism"):
     The assistant NEVER cancels, reschedules, or alters appointments directly.
     Politely explain that cancellations or rescheduling must be performed in the appointment details or handled directly with the parish office, and provide a handoff:
     \`\`\`json
     {
       "handoff": {
         "type": "appointment",
         "label": "View Appointment",
         "url": "/appointments"
       }
     }
     \`\`\`
   - When the user asks to send a direct message to clergy or staff (e.g. "Message Father", "Send message to priest"):
     The assistant NEVER sends direct messages directly.
     Politely explain that direct messaging can be accessed via the Messages center, and provide a handoff:
     \`\`\`json
     {
       "handoff": {
         "type": "messages",
         "label": "Go to Messages",
         "url": "/messages"
       }
     }
     \`\`\``;

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
    let activeModelName = 'offline-fallback';
    let totalTurnsCount = 0;
    const executedTools: Array<{ name: string; args: any; result: any }> = [];
    const MAX_TOOL_TURNS = 5;

    for (const model of GEMINI_CHAT_MODELS) {
      try {
        let toolTurns = 0;
        const currentContents = JSON.parse(JSON.stringify(contents));

        while (toolTurns < MAX_TOOL_TURNS) {
          toolTurns++;
          let response: Response | null = null;
          let keysAttempted = 0;
          const maxKeyAttempts = Math.max(1, geminiKeys.length);

          while (keysAttempted < maxKeyAttempts) {
            const currentApiKey = getActiveGeminiKey(geminiKeys);
            const endpoint = `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
            response = await postToGemini(endpoint, {
              system_instruction: { parts: [{ text: systemInstruction }] },
              contents: currentContents,
              tools,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 800,
              },
            }, geminiHeaders);

            if (response.status === 429 && geminiKeys.length > 1 && keysAttempted < maxKeyAttempts - 1) {
              console.warn(`Model ${model} returned 429 with key index ${activeGeminiKeyIndex % geminiKeys.length}. Rotating key in pool...`);
              rotateGeminiKey(geminiKeys);
              keysAttempted++;
              continue;
            }
            break;
          }

          if (!response || !response.ok) {
            const errText = response ? await response.text() : 'No response';
            if (response && RETRYABLE_STATUSES.has(response.status)) {
              console.warn(`Model ${model} returned retryable ${response.status}: ${errText}`);
              break; // Try next model
            }
            throw new Error(`Gemini API error (${response?.status}): ${errText}`);
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
              churchId,
              {
                geminiBaseUrl: GEMINI_BASE_URL,
                geminiApiKey: getActiveGeminiKey(geminiKeys),
                serviceClient,
              }
            );

            executedTools.push({
              name: fnCall.name,
              args: fnCall.args,
              result: toolResult,
            });

            if (toolResult.schedules) sourcesUsed += toolResult.schedules.length;
            if (toolResult.parishes) sourcesUsed += toolResult.parishes.length;
            if (toolResult.services) sourcesUsed += toolResult.services.length;
            if (toolResult.requirements) sourcesUsed += toolResult.requirements.length;
            if (toolResult.appointments) sourcesUsed += toolResult.appointments.length;
            if (toolResult.results) sourcesUsed += toolResult.results.length;
            if (toolResult.available !== undefined) sourcesUsed += 1;

            // Append model call turn verbatim (preserving thought_signature for multi-turn)
            currentContents.push(candidate.content);

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
          activeModelName = model;
          totalTurnsCount = toolTurns;
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
        "I'm sorry, I couldn't retrieve the parish information at this moment. Please try again shortly or contact the parish office.";
    }

    let bookingProposal: any = null;
    let intent: any = null;
    let handoff: any = null;

    // 1. Try extracting structured JSON code block from model response
    const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const jsonMatch = finalReply.match(jsonBlockRegex);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.intent) intent = parsed.intent;
        if (parsed.bookingProposal) bookingProposal = parsed.bookingProposal;
        if (parsed.handoff) handoff = parsed.handoff;
        finalReply = finalReply.replace(jsonMatch[0], '').trim();
      } catch (err) {
        console.warn('Failed to parse model JSON block:', err);
      }
    } else {
      // 2. Check if entire reply is pure JSON
      try {
        const trimmed = finalReply.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(trimmed);
          if (parsed.reply) finalReply = parsed.reply;
          if (parsed.intent) intent = parsed.intent;
          if (parsed.bookingProposal) bookingProposal = parsed.bookingProposal;
          if (parsed.handoff) handoff = parsed.handoff;
        }
      } catch {
        // Not pure JSON
      }
    }

    // 3. Fallback intent & proposal detection if model did not produce JSON
    if (!intent) {
      if (
        /(?:talk\s+to\s+(?:the\s+)?parish\s+office|kausapin\s+ang\s+parish\s+office|makausap\s+ang\s+parish\s+office|contact\s+(?:the\s+)?parish\s+office|talk\s+to\s+office|draft\s+(?:a\s+)?ticket)/i.test(
          message
        )
      ) {
        let category = 'general';
        if (/baptism|binyag/i.test(message)) category = 'baptism';
        else if (/wedding|kasal/i.test(message)) category = 'wedding';
        else if (/funeral|libing/i.test(message)) category = 'funeral';
        else if (/certificate|katibayan/i.test(message)) category = 'certificate';
        else if (/intention|misa/i.test(message)) category = 'mass_intention';

        intent = {
          type: 'draft_ticket',
          category,
          subject: 'Inquiry regarding parish services',
          message: 'Hello, I would like to inquire about parish services.',
        };
      } else if (
        /(?:i\s+want\s+to\s+book|mag[-\s]?book\s+ng|magpa-?binyag|magpa-?kasal|schedule\s+a\s+baptism|book\s+a\s+baptism|gusto\s+ko(?:ng)?\s+mag[-\s]?book|gusto\s+ko(?:ng)?\s+magpa-?binyag|mag[-\s]?book)/i.test(
          message
        )
      ) {
        let serviceName = 'Baptism';
        if (/wedding|kasal/i.test(message)) serviceName = 'Wedding';
        else if (/confirmation|kumpil/i.test(message)) serviceName = 'Confirmation';
        else if (/blessing|bendisyon/i.test(message)) serviceName = 'Blessing';
        else if (/funeral|libing/i.test(message)) serviceName = 'Funeral';
        intent = { type: 'start_booking', serviceName };
      } else if (/(?:change\s+(?:the\s+)?date|palitan\s+ang\s+petsa)/i.test(message)) {
        intent = { type: 'change_step', step: 'date' };
      } else if (/(?:change\s+(?:the\s+)?time|palitan\s+ang\s+oras)/i.test(message)) {
        intent = { type: 'change_step', step: 'time' };
      } else if (/(?:change\s+(?:the\s+)?service|palitan\s+ang\s+sakramento)/i.test(message)) {
        intent = { type: 'change_step', step: 'service' };
      }
    }

    if (!handoff) {
      if (
        /(?:cancel|reschedule|move|postpone)\s+(?:my\s+)?(?:wedding|baptism|funeral|confirmation|blessing|appointment|booking)/i.test(
          message
        )
      ) {
        handoff = {
          type: 'appointment',
          label: 'View Appointment',
          url: '/appointments',
        };
      } else if (
        /(?:message|chat\s+with|send\s+message\s+to)\s+(?:father|fr\.?|priest|padre|staff)/i.test(
          message
        )
      ) {
        handoff = {
          type: 'messages',
          label: 'Go to Messages',
          url: '/messages',
        };
      }
    }

    // Log exchange once to church_chat_logs using service role client
    try {
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
    const isMock =
      GEMINI_BASE_URL.includes('54399') ||
      GEMINI_BASE_URL.includes('localhost') ||
      GEMINI_BASE_URL.includes('127.0.0.1');

    return new Response(
      JSON.stringify({
        reply: finalReply,
        sourcesUsed,
        bookingProposal,
        intent,
        handoff,
        debug: {
          model: activeModelName,
          isMock,
          tools: executedTools,
          turns: totalTurnsCount,
        },
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
        debug: {
          model: 'error-fallback',
          isMock: false,
          tools: [],
          turns: 0,
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
