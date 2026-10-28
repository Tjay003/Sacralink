import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Visual tone of a status. Every status in the app maps to exactly one tone so the same state always looks the same. */
export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'gold' | 'live';

export type StatusDomain =
    | 'appointment'
    | 'application'
    | 'applicant'
    | 'church'
    | 'user'
    | 'donation'
    | 'ticket'
    | 'announcement'
    | 'broadcast'
    | 'sync'
    | 'availability';

interface StatusDefinition {
    tone: StatusTone;
    label: string;
    /** Animates the dot for states that are in flight or need attention. */
    pulse?: boolean;
}

/**
 * Canonical status table, keyed by domain then by the raw status value stored in the database (or derived in the UI).
 * Emerald = done/healthy, Sacred Gold = waiting on a human, Faith Blue = in progress/scheduled,
 * Red = refused/blocked/live, Stone Gray = inactive/ended.
 */
export const STATUS_DEFINITIONS: Record<StatusDomain, Record<string, StatusDefinition>> = {
    appointment: {
        pending: { tone: 'warning', label: 'Pending', pulse: true },
        approved: { tone: 'info', label: 'Approved' },
        completed: { tone: 'success', label: 'Celebrated' },
        celebrated: { tone: 'success', label: 'Celebrated' },
        rejected: { tone: 'danger', label: 'Rejected' },
        cancelled: { tone: 'neutral', label: 'Cancelled' },
    },
    application: {
        pending: { tone: 'warning', label: 'Pending', pulse: true },
        under_review: { tone: 'info', label: 'Under review' },
        verified_active: { tone: 'success', label: 'Verified' },
        rejected: { tone: 'danger', label: 'Rejected' },
    },
    applicant: {
        not_submitted: { tone: 'neutral', label: 'Not submitted' },
        pending: { tone: 'warning', label: 'Awaiting review', pulse: true },
        passed: { tone: 'success', label: 'Verified' },
        rejected: { tone: 'danger', label: 'Rejected' },
    },
    church: {
        verified_active: { tone: 'gold', label: 'Verified', pulse: true },
        active: { tone: 'success', label: 'Active' },
        unverified: { tone: 'warning', label: 'Under audit' },
        inactive: { tone: 'neutral', label: 'Inactive' },
        archived: { tone: 'neutral', label: 'Archived' },
    },
    user: {
        active: { tone: 'success', label: 'Active' },
        suspended: { tone: 'danger', label: 'Suspended' },
        archived: { tone: 'neutral', label: 'Archived' },
    },
    donation: {
        pending: { tone: 'warning', label: 'Awaiting check', pulse: true },
        verified: { tone: 'success', label: 'Verified' },
        rejected: { tone: 'danger', label: 'Rejected' },
    },
    ticket: {
        open: { tone: 'info', label: 'Open' },
        in_progress: { tone: 'warning', label: 'In Progress' },
        resolved: { tone: 'success', label: 'Resolved' },
        closed: { tone: 'neutral', label: 'Closed' },
    },
    announcement: {
        info: { tone: 'info', label: 'Info' },
        warning: { tone: 'warning', label: 'Warning' },
        maintenance: { tone: 'neutral', label: 'Maintenance' },
        success: { tone: 'success', label: 'Success' },
    },
    broadcast: {
        live: { tone: 'live', label: 'LIVE', pulse: true },
        offline: { tone: 'neutral', label: 'Offline' },
    },
    sync: {
        synced: { tone: 'success', label: 'Synced' },
        syncing: { tone: 'info', label: 'Syncing...', pulse: true },
        needs_sync: { tone: 'warning', label: 'Needs a sync' },
        error: { tone: 'danger', label: 'Sync error' },
    },
    availability: {
        available: { tone: 'success', label: 'Available' },
        eligible: { tone: 'warning', label: 'Eligible' },
        unavailable: { tone: 'danger', label: 'Unavailable' },
    },
};

const TONE_CLASSES: Record<StatusTone, { pill: string; activePill: string; dot: string }> = {
    success: {
        pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        activePill: 'bg-emerald-100/90 text-emerald-900 border-emerald-400 ring-1 ring-emerald-300/70 shadow-2xs',
        dot: 'bg-emerald-500',
    },
    warning: {
        pill: 'bg-amber-50 text-amber-800 border-amber-200',
        activePill: 'bg-amber-100/90 text-amber-900 border-amber-400 ring-1 ring-amber-300/70 shadow-2xs',
        dot: 'bg-amber-500',
    },
    gold: {
        pill: 'bg-amber-50 text-amber-800 border-amber-300',
        activePill: 'bg-amber-100/90 text-amber-900 border-amber-400 ring-1 ring-amber-300/70 shadow-2xs',
        dot: 'bg-amber-500',
    },
    info: {
        pill: 'bg-blue-50 text-blue-700 border-blue-200',
        activePill: 'bg-blue-100/90 text-blue-900 border-blue-400 ring-1 ring-blue-300/70 shadow-2xs',
        dot: 'bg-primary',
    },
    danger: {
        pill: 'bg-red-50 text-red-700 border-red-200',
        activePill: 'bg-red-100/90 text-red-900 border-red-400 ring-1 ring-red-300/70 shadow-2xs',
        dot: 'bg-red-500',
    },
    neutral: {
        pill: 'bg-secondary-100 text-secondary-700 border-secondary-200',
        activePill: 'bg-secondary-200/90 text-secondary-900 border-secondary-400 ring-1 ring-secondary-300/70 shadow-2xs',
        dot: 'bg-secondary-500',
    },
    live: {
        pill: 'bg-red-600 text-white border-red-600',
        activePill: 'bg-red-700 text-white border-red-700 ring-1 ring-red-400 shadow-2xs',
        dot: 'bg-white',
    },
};

const FALLBACK: StatusDefinition = { tone: 'neutral', label: '' };

/**
 * Returns the canonical pill, active-filter pill, and indicator-dot classes for a domain + status pair.
 * Used by status filter bars so filter tabs share the exact same palette as `<StatusBadge />`.
 */
export function getStatusToneClasses(domain: StatusDomain, status: string) {
    const definition = STATUS_DEFINITIONS[domain][status] ?? FALLBACK;
    return {
        ...TONE_CLASSES[definition.tone],
        pulse: Boolean(definition.pulse),
    };
}

function humanize(raw: string): string {
    const spaced = raw.replace(/_/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface StatusBadgeProps {
    /** Raw status value, for example `pending` or `verified_active`. */
    status?: string | null;
    domain: StatusDomain;
    /** Replaces the canonical label, for example to add a count or qualifier. */
    label?: string;
    /** `sm` suits dense tables and lists, `md` suits cards and modals. */
    size?: 'sm' | 'md';
    showDot?: boolean;
    /** Replaces the dot with an icon. */
    icon?: LucideIcon;
    className?: string;
}

/**
 * The one way to show a status. Colour comes from the canonical table above, never from the call site, and a dot
 * (or icon) accompanies the colour so the state is not conveyed by colour alone. Unknown statuses render neutral
 * with a humanized label rather than crashing.
 */
export function StatusBadge({ status, domain, label, size = 'md', showDot = true, icon: Icon, className }: StatusBadgeProps) {
    const key = status ?? '';
    const definition = STATUS_DEFINITIONS[domain][key] ?? { ...FALLBACK, label: humanize(key || 'unknown') };
    const tone = TONE_CLASSES[definition.tone];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap shrink-0',
                size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
                tone.pill,
                className,
            )}
        >
            {Icon ? (
                <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
            ) : (
                showDot && (
                    <span
                        aria-hidden="true"
                        className={cn('w-1.5 h-1.5 rounded-full', tone.dot, definition.pulse && 'animate-pulse')}
                    />
                )
            )}
            {label ?? definition.label}
        </span>
    );
}
