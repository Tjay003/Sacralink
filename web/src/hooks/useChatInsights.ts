import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface InquiryInsightItem {
    id: string;
    created_at: string;
    user_question: string;
    assistant_reply: string;
    status: 'unanswered' | 'addressed';
}

export interface ChatInsightsData {
    totalInquiries: number;
    unansweredCount: number;
    recentUnanswered: InquiryInsightItem[];
    allInquiries: InquiryInsightItem[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    markAsAddressed: (id: string) => void;
    generateFaqDraft: (question: string, replySnippet?: string) => { title: string; draftContent: string };
}

export const UNANSWERED_KEYWORDS: readonly string[] = [
    'contact the parish office',
    'makipag-ugnayan sa tanggapan',
    'hindi ko po tiyak',
    'hindi ko po alam',
    'no information available',
    'wala pong impormasyon',
    'offline-fallback',
    'do not have information',
    'hindi ko hawak',
    'magtanong sa tanggapan',
    'please contact the parish',
    'reach out to the parish office',
    'wala akong impormasyon',
];

/**
 * Checks whether an assistant's response indicated low confidence, missing knowledge,
 * or instructed the parishioner to contact the office.
 */
export function isUnansweredQuery(answer: string | null | undefined): boolean {
    if (!answer) return true;
    const lower = answer.toLowerCase();
    return UNANSWERED_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Generates a dignified FAQ title and structured markdown draft from a parishioner inquiry.
 */
export function generateFaqDraft(
    question: string,
    replySnippet?: string
): { title: string; draftContent: string } {
    const cleanQuestion = question.trim().replace(/^["']|["']$/g, '');
    const baseQuestion = cleanQuestion.replace(/[?!.]+$/, '').trim();

    let title = baseQuestion;
    const lower = baseQuestion.toLowerCase();

    if (/hall|rent|reception|pasilidad|facility/i.test(lower)) {
        title = 'Parish Hall Rentals & Reception Guidelines';
    } else if (/crypt|columbarium|niche|libingan|burial|funeral/i.test(lower)) {
        title = 'Columbarium, Crypt & Funeral Inquiries';
    } else if (/wedding|kasal|marriage|marry|married|matrimony/i.test(lower)) {
        title = 'Wedding Requirements & Guidelines';
    } else if (/baptism|binyag|godparent|ninong|ninang/i.test(lower)) {
        title = 'Baptism Requirements & Godparent Policies';
    } else if (/mass|misa|schedule/i.test(lower)) {
        title = 'Mass Schedules & Liturgical Guidelines';
    } else if (/confession|kumpisal/i.test(lower)) {
        title = 'Confession Schedules & Sacramental Preparation';
    } else if (/office|hours|schedule|operating/i.test(lower)) {
        title = 'Parish Office Hours & General Inquiries';
    } else if (/certificate|record|katunayan/i.test(lower)) {
        title = 'Sacramental Certificates & Records Requests';
    } else {
        title = baseQuestion.charAt(0).toUpperCase() + baseQuestion.slice(1);
    }

    const contextSnippet = replySnippet
        ? `\n> *Assistant Note:* "${replySnippet.slice(0, 140)}..."\n`
        : '';

    const draftContent = `### Frequently Asked Question
**Q: ${cleanQuestion}**
${contextSnippet}
**Pastoral Guidance & Parish Policy:**
[Please provide the official parish policy, procedures, and answers to this inquiry here.]

**Requirements & Important Guidelines:**
- **Eligibility:** [Specify who may apply, register, or make reservations]
- **Document Requirements:** [List necessary documents, IDs, or forms]
- **Office Coordination:** Please visit or contact the Parish Office during regular operating hours for official arrangements and scheduling.

*Note for Parishioners: All arrangements are subject to official parish guidelines and liturgical calendar availability.*`;

    return { title, draftContent };
}

/**
 * Hook to retrieve and analyze church chat interactions for the active church.
 * Surfaces inquiry analytics, detects knowledge gaps, and provides 1-click FAQ drafts.
 */
export function useChatInsights(churchId: string | null): ChatInsightsData {
    const [rawLogs, setRawLogs] = useState<Array<{
        id: string;
        created_at: string | null;
        question: string;
        answer: string;
    }>>([]);
    const [addressedIds, setAddressedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Load addressed IDs from localStorage
    useEffect(() => {
        if (!churchId) return;
        try {
            const stored = localStorage.getItem(`kb_addressed_inquiries_${churchId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setAddressedIds(new Set(parsed));
                }
            }
        } catch {
            // Ignore parse errors
        }
    }, [churchId]);

    const fetchLogs = useCallback(async () => {
        if (!churchId) {
            setRawLogs([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error: queryError } = await (supabase as any)
                .from('church_chat_logs')
                .select('id, question, answer, created_at')
                .eq('church_id', churchId)
                .gte('created_at', thirtyDaysAgo)
                .order('created_at', { ascending: false });

            if (queryError) {
                throw queryError;
            }

            setRawLogs(data || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch chat logs';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [churchId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const markAsAddressed = useCallback((id: string) => {
        if (!churchId) return;
        setAddressedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem(`kb_addressed_inquiries_${churchId}`, JSON.stringify(Array.from(next)));
            } catch {
                // Ignore storage errors
            }
            return next;
        });
    }, [churchId]);

    const allInquiries: InquiryInsightItem[] = useMemo(() => {
        return rawLogs.map((log) => ({
            id: log.id,
            created_at: log.created_at || new Date().toISOString(),
            user_question: log.question,
            assistant_reply: log.answer,
            status: addressedIds.has(log.id) ? 'addressed' : 'unanswered',
        }));
    }, [rawLogs, addressedIds]);

    const recentUnanswered: InquiryInsightItem[] = useMemo(() => {
        return allInquiries.filter((item) => isUnansweredQuery(item.assistant_reply));
    }, [allInquiries]);

    const unansweredCount = useMemo(() => {
        return recentUnanswered.filter((item) => item.status === 'unanswered').length;
    }, [recentUnanswered]);

    const totalInquiries = allInquiries.length;

    return {
        totalInquiries,
        unansweredCount,
        recentUnanswered,
        allInquiries,
        loading,
        error,
        refresh: fetchLogs,
        markAsAddressed,
        generateFaqDraft,
    };
}
