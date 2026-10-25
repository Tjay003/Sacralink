/**
 * Formatting and sanitization utilities for the Sacralink Pastoral Neural Inspector.
 * Formats internal database tool invocations into high-level pastoral validation steps,
 * ensuring presentation-ready confidentiality and consistent domain branding.
 */

export interface FormattedPastoralTool {
    label: string;
    description: string;
}

/**
 * Maps raw database tools to professional pastoral pipeline operations.
 */
export function formatPastoralTool(toolName: string): FormattedPastoralTool {
    switch (toolName) {
        case 'get_mass_schedule':
            return {
                label: 'Liturgical Mass Schedule Query',
                description: 'Real-time schedule synchronization across parish liturgical calendar',
            };
        case 'list_parishes':
            return {
                label: 'Diocesan Parish Directory Verification',
                description: 'Verifying active Catholic parishes and canonical boundaries',
            };
        case 'find_mass_across_parishes':
            return {
                label: 'Cross-Parish Mass Time Search',
                description: 'Scanning neighboring diocesan parish schedules for liturgy times',
            };
        case 'get_bookable_services':
            return {
                label: 'Sacramental Services Directory',
                description: 'Retrieving official sacramental rites and bookable parish services',
            };
        case 'get_sacrament_requirements':
            return {
                label: 'Canonical Requirements Engine',
                description: 'Validating mandatory certificates, sponsors, and parish documentation',
            };
        case 'check_slot_availability':
            return {
                label: 'Parish Calendar Time-Slot Validation',
                description: 'Verifying real-time altar and sanctuary availability against bookings',
            };
        case 'check_priest_availability':
            return {
                label: 'Clergy Liturgical Schedule Matrix',
                description: 'Verifying assigned celebrant availability and duty calendar',
            };
        case 'get_my_appointments':
            return {
                label: 'Parishioner Sacrament Records',
                description: 'Securely retrieving active sacrament bookings and schedule records',
            };
        case 'get_parish_team':
            return {
                label: 'Pastoral Team & Clergy Directory',
                description: 'Verifying parish pastoral council and parish office directory',
            };
        case 'search_church_knowledge':
            return {
                label: 'Parish Knowledge & Canon Base',
                description: 'Indexing parish custom liturgical directives, history, and guidelines',
            };
        default:
            return {
                label: toolName
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                description: 'Autonomous parish database query executed successfully',
            };
    }
}

/**
 * Normalizes model names for presentation to reinforce Sacralink's custom domain model.
 */
export function formatModelName(rawModel?: string): string {
    if (!rawModel) return 'Sacralink Pastoral Neural Core v2.5';
    const lower = rawModel.toLowerCase();
    if (lower.includes('gemini') || lower.includes('google') || lower.includes('fallback') || lower.includes('keyword')) {
        return 'Sacralink Pastoral Neural Core v2.5';
    }
    return rawModel.replace(/gemini[^\s]*/gi, 'sacralink-neural-v2.5');
}
