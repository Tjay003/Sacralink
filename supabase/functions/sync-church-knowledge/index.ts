import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getEmbedding(
  text: string,
  apiKey: string,
  baseUrl = 'https://generativelanguage.googleapis.com'
): Promise<number[]> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const response = await fetch(
    `${cleanBase}/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding failed (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return data.embedding.values;
}

/**
 * Semantic chunking: split by blank lines / headings, then sub-split long paragraphs.
 * Adds a 100-char overlap between consecutive chunks so context isn't lost at boundaries.
 */
function chunkText(text: string, maxChars = 500, overlap = 100): string[] {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into semantic blocks on double newlines or heading-style lines
  const blocks = normalized
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(b => b.length > 10);

  const chunks: string[] = [];
  let lastChunkEnd = '';

  for (const block of blocks) {
    if (block.length <= maxChars) {
      // Block fits in one chunk — prepend overlap from previous chunk
      const chunk = lastChunkEnd ? `${lastChunkEnd}\n${block}` : block;
      chunks.push(chunk.trim());
      lastChunkEnd = block.slice(-overlap);
    } else {
      // Block too long — split on sentence boundaries
      const sentences = block.split(/(?<=[.!?])\s+/);
      let current = lastChunkEnd ? lastChunkEnd + '\n' : '';

      for (const sentence of sentences) {
        if ((current + sentence).length > maxChars && current.trim().length > 0) {
          chunks.push(current.trim());
          // Carry last `overlap` chars into the next chunk
          current = current.slice(-overlap) + ' ' + sentence;
        } else {
          current += (current ? ' ' : '') + sentence;
        }
      }
      if (current.trim().length > 10) {
        chunks.push(current.trim());
        lastChunkEnd = current.slice(-overlap);
      }
    }
  }

  return chunks.filter(c => c.length > 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const rawBaseUrl =
      Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com';
    const GEMINI_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { churchId } = await req.json();
    if (!churchId) {
      return new Response(JSON.stringify({ error: 'churchId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Hybrid SSOT Cleanup: Purge any existing mass_schedule chunks for this church.
    // Mass schedules are queried live via get_mass_schedule and must never be stored as static vector chunks.
    // Even if there are no new chunks to process, this guarantees stale mass_schedule chunks are removed.
    const { error: purgeError } = await supabase
      .from('church_knowledge_chunks')
      .delete()
      .eq('church_id', churchId)
      .eq('source_type', 'mass_schedule');

    if (purgeError) {
      console.error('Failed to purge mass_schedule chunks:', purgeError);
    }

    const chunks: Array<{ church_id: string; content: string; source_type: string; source_id?: string }> = [];

    // 1. Church basic info
    const { data: church } = await supabase
      .from('churches')
      .select('id, name, address, contact_number, email, description, operating_hours')
      .eq('id', churchId)
      .single();

    if (church) {
      let info = `Church Name: ${church.name}\n`;
      if (church.address) info += `Address: ${church.address}\n`;
      if (church.contact_number) info += `Contact Number: ${church.contact_number}\n`;
      if (church.email) info += `Email: ${church.email}\n`;
      if (church.description) info += `Description: ${church.description}\n`;
      if (church.operating_hours) info += `Operating Hours: ${church.operating_hours}\n`;
      chunks.push({ church_id: churchId, content: info.trim(), source_type: 'church_info', source_id: church.id });
    }

    // 2. Sacrament requirements
    const { data: requirements } = await supabase
      .from('sacrament_requirements')
      .select('id, service_type, requirement_name, description, is_required')
      .eq('church_id', churchId)
      .order('service_type')
      .order('display_order');

    if (requirements && requirements.length > 0) {
      const byService: Record<string, typeof requirements> = {};
      for (const r of requirements) {
        const svc = r.service_type || 'General';
        if (!byService[svc]) byService[svc] = [];
        byService[svc].push(r);
      }
      for (const [serviceType, reqs] of Object.entries(byService)) {
        const label = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
        const reqLines = reqs.map(r => {
          let line = `- ${r.requirement_name}`;
          if (r.description) line += `: ${r.description}`;
          if (r.is_required === false) line += ' (optional)';
          return line;
        }).join('\n');
        chunks.push({
          church_id: churchId,
          content: `Requirements for ${label}:\n${reqLines}`,
          source_type: 'requirement'
        });
      }
    }

    // 3. Announcements (latest 10)
    const { data: announcements } = await supabase
      .from('church_announcements')
      .select('id, title, content')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (announcements) {
      for (const ann of announcements) {
        let content = `Announcement: ${ann.title || 'Notice'}`;
        if (ann.content) content += `\n${ann.content}`;
        chunks.push({ church_id: churchId, content: content.trim(), source_type: 'announcement', source_id: ann.id });
      }
    }

    // 4. Custom Knowledge Sections — semantic chunking with overlap
    const { data: sections } = await supabase
      .from('church_knowledge_sections')
      .select('id, title, content')
      .eq('church_id', churchId)
      .order('display_order');

    if (sections && sections.length > 0) {
      for (const section of sections) {
        if (!section.content?.trim()) continue;
        const textChunks = chunkText(section.content);
        for (const chunk of textChunks) {
          chunks.push({
            church_id: churchId,
            content: `[${section.title}]\n${chunk}`,
            source_type: 'knowledge_section',
            source_id: section.id,
          });
        }
      }
      console.log(`Processed ${sections.length} knowledge sections into chunks`);
    }

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, chunksProcessed: 0, message: 'No church data found to sync.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test embedding before wiping
    try {
      await getEmbedding('test', GEMINI_API_KEY, GEMINI_BASE_URL);
    } catch (testErr: any) {
      return new Response(
        JSON.stringify({ error: `Gemini embedding error: ${testErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear and re-sync
    await supabase.from('church_knowledge_chunks').delete().eq('church_id', churchId);

    const rows = [];
    for (const chunk of chunks) {
      try {
        const embedding = await getEmbedding(chunk.content, GEMINI_API_KEY, GEMINI_BASE_URL);
        rows.push({ ...chunk, embedding: `[${embedding.join(',')}]` });
        await new Promise(r => setTimeout(r, 150));
      } catch (e: any) {
        console.error('Chunk embed failed:', e.message.substring(0, 100));
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('church_knowledge_chunks').insert(rows);
      if (insertError) throw new Error(`DB insert error: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, chunksProcessed: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('sync-church-knowledge error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
