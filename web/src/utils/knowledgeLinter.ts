/**
 * Knowledge Base Discrepancy Linter
 * 
 * Fast, pure client-side linter that detects hardcoded Mass schedules and service fees
 * in parish knowledge base entries, enforcing the Hybrid Single Source of Truth (SSOT).
 */

export interface KnowledgeLintIssue {
    type: 'mass_schedule' | 'service_fee';
    severity: 'warning';
    message: string;
    matchedText: string;
    suggestion: string;
}

export interface KnowledgeLintResult {
    hasWarnings: boolean;
    issues: KnowledgeLintIssue[];
}

/**
 * Regex patterns identifying Mass and liturgical schedules
 */
const MASS_SCHEDULE_PATTERNS: RegExp[] = [
    // Liturgical keywords connected with time, e.g. "Sunday Mass at 7:00 AM", "Weekday Mass 6pm", "Misa ng Linggo 8:00 AM"
    /\b(?:(?:sunday|saturday|daily|weekday|weekend|anticipated)\s+)?(?:mass|misa)(?:(?:\s+[a-zA-Z]+){1,3})?\s*(?:at|:|@|-)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,

    // Time followed by mass/misa, e.g. "7:00 am mass", "6pm misa"
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:mass|misa)\b/gi,

    // Mass / misa followed by schedule or time markers, e.g. "Mass schedule", "Mass times", "Mass at", "Misa tuwing"
    /\b(?:mass|misa)\s+(?:schedules?|times?|at|tuwing|sa)\b/gi,

    // Day of week + Mass/Misa, e.g. "Sunday Mass", "Weekday Mass", "Misa ng Linggo", "Linggo na misa"
    /\b(?:sunday|saturday|daily|weekday|weekend|anticipated)\s+(?:mass|misa)\b/gi,
    /\b(?:mass|misa)\s+(?:ng|sa)\s+(?:linggo|sabado|araw-araw)\b/gi,
    /\b(?:linggo|sabado|araw-araw)\s+(?:na\s+)?(?:mass|misa)\b/gi,

    // Mass / Misa with colon time, e.g. "Mass: 6:00 AM", "Misa: 7:00"
    /\b(?:mass|misa)\s*:\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi,
];

/**
 * Regex patterns identifying fees, prices, and stipends
 */
const FEE_PATTERNS: RegExp[] = [
    // Fee keyword followed by amount, e.g. "fee: 500 pesos", "bayad: 200", "donation amounting to 1000 pesos"
    /\b(?:fee|fees|bayad|donation|donations|stipend|stipends|rate|rates|charge|charges)\s*(?:is|:|amounting to|-)?\s*(?:₱|php)?\s*\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:pesos?)?\b/gi,

    // Amount followed by fee keywords, e.g. "₱500 fee", "Php 1,500 donation", "5000 pesos wedding fee"
    /(?:₱|php)?\s*\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:pesos?)?\s*(?:fee|fees|bayad|donation|donations|stipend|stipends)\b/gi,

    // Currency symbol or code followed by numbers: "₱500", "Php 1,500", "PHP 500.00"
    /(?:₱|php|pesos?)\s*\d+(?:,\d{3})*(?:\.\d{2})?/gi,

    // Standalone number followed by currency denomination: "5000 pesos", "500 peso"
    /\b\d+(?:,\d{3})*(?:\.\d{2})?\s*pesos?\b/gi,
];

/**
 * Helper to add an issue while deduplicating and preferring longer/more descriptive matches
 */
function recordIssue(issues: KnowledgeLintIssue[], newIssue: KnowledgeLintIssue) {
    const norm = newIssue.matchedText.toLowerCase().trim();
    if (!norm) return;

    // If an existing issue of the same type already subsumes this match, skip
    if (issues.some(i => i.type === newIssue.type && i.matchedText.toLowerCase().includes(norm))) {
        return;
    }

    // If this match is more descriptive and subsumes earlier matches, replace them
    for (let idx = issues.length - 1; idx >= 0; idx--) {
        if (issues[idx].type === newIssue.type && norm.includes(issues[idx].matchedText.toLowerCase())) {
            issues.splice(idx, 1);
        }
    }

    issues.push(newIssue);
}

/**
 * Lints a title and content pair for hardcoded Mass schedules and service fees
 */
export function lintKnowledgeSection(title: string, content: string): KnowledgeLintResult {
    const issues: KnowledgeLintIssue[] = [];
    const textsToLint = [title || '', content || ''].filter(t => t.trim().length > 0);

    for (const text of textsToLint) {
        // 1. Check for Mass schedule patterns
        for (const pattern of MASS_SCHEDULE_PATTERNS) {
            // Reset regex state
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const matchedText = match[0].trim();
                if (matchedText) {
                    recordIssue(issues, {
                        type: 'mass_schedule',
                        severity: 'warning',
                        message: 'Hardcoded Mass schedule or time detected.',
                        matchedText,
                        suggestion: 'Manage Mass schedules in the Liturgy tab so they stay synchronized with live bookings and the AI assistant.',
                    });
                }
            }
        }

        // 2. Check for fee patterns
        for (const pattern of FEE_PATTERNS) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const matchedText = match[0].trim();
                if (matchedText) {
                    recordIssue(issues, {
                        type: 'service_fee',
                        severity: 'warning',
                        message: 'Hardcoded fee or payment amount detected.',
                        matchedText,
                        suggestion: 'Configure sacramental and service fees in the Services tab so bookings and automated receipts stay accurate.',
                    });
                }
            }
        }
    }

    return {
        hasWarnings: issues.length > 0,
        issues,
    };
}
