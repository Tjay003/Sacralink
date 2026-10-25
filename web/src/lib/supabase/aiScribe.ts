import { supabase } from '../supabase';

export interface PolishKnowledgeResult {
    polishedTitle: string;
    polishedContent: string;
    trace?: {
        model: string;
        durationMs: number;
        rawWordCount: number;
        polishedWordCount: number;
        analysis: string;
        timestamp: string;
    };
}

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Fallback typography and pastoral formatting for offline mode or network timeouts.
 */
export function offlinePolishFallback(title: string, rawContent: string, durationMs = 0): PolishKnowledgeResult {
    const cleanTitle = title.trim() || 'Parish Guidelines & Policy';
    const lines = rawContent
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const formattedBullets = lines.map(line => {
        const stripped = line.replace(/^[-*•\d.]\s*/, '').trim();
        if (!stripped) return '';
        return `• ${stripped.charAt(0).toUpperCase() + stripped.slice(1)}`;
    }).filter(Boolean);

    const bulletsBlock = formattedBullets.length > 0
        ? formattedBullets.join('\n')
        : '• Please observe all standard parish guidelines and liturgical decorum.';

    const polishedContent = `### Liturgical Decorum & Guidelines

To preserve the sacredness of our parish celebrations and ensure a prayerful experience for all worshippers, we kindly invite all parishioners to observe the following pastoral guidelines:

${bulletsBlock}

*For further inquiries, sacramental verification, or pastoral guidance, please visit or contact the parish office.*`;

    return {
        polishedTitle: cleanTitle,
        polishedContent,
        trace: {
            model: 'heuristic-formatter (offline)',
            durationMs,
            rawWordCount: countWords(rawContent),
            polishedWordCount: countWords(polishedContent),
            analysis: 'Tone: Reverent Pastoral Guidelines • Structure: Markdown AST',
            timestamp: new Date().toISOString(),
        },
    };
}

/**
 * Calls AI Scribe in the parish-assistant edge function to transform draft bullet points
 * into warm, respectful, and reverent pastoral Catholic guidelines.
 */
export async function polishKnowledgeContent(
    title: string,
    rawContent: string,
    churchName?: string
): Promise<PolishKnowledgeResult> {
    if (!rawContent || rawContent.trim().length === 0) {
        return {
            polishedTitle: title.trim() || 'Parish Guidelines',
            polishedContent: '',
        };
    }

    const startTime = Date.now();

    try {
        // Enforce a 15-second timeout on the request
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI Scribe request timed out')), 15000)
        );

        const invokePromise = supabase.functions.invoke('parish-assistant', {
            body: {
                action: 'polish_knowledge',
                title: title.trim(),
                content: rawContent.trim(),
                churchName: churchName || undefined,
            },
        });

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
        const durationMs = Math.round(Date.now() - startTime);

        if (error) {
            console.warn('[aiScribe] Edge function returned error, using fallback:', error);
            return offlinePolishFallback(title, rawContent, durationMs);
        }

        if (data && data.success && data.polishedContent) {
            const polishedText = data.polishedContent;
            return {
                polishedTitle: data.polishedTitle || title.trim() || 'Parish Guidelines',
                polishedContent: polishedText,
                trace: {
                    model: data.model || 'sacralink-scribe-v2.5',
                    durationMs: typeof data.durationMs === 'number' ? data.durationMs : durationMs,
                    rawWordCount: countWords(rawContent),
                    polishedWordCount: countWords(polishedText),
                    analysis: 'Tone: Reverent Pastoral Guidelines • Structure: Markdown AST',
                    timestamp: new Date().toISOString(),
                },
            };
        }

        return offlinePolishFallback(title, rawContent, durationMs);
    } catch (err) {
        const durationMs = Math.round(Date.now() - startTime);
        console.warn('[aiScribe] Exception while polishing, using fallback:', err);
        return offlinePolishFallback(title, rawContent, durationMs);
    }
}
