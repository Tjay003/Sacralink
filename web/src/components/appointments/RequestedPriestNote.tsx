import { UserCheck } from 'lucide-react';
import { getRequestedPriestLabel, type RequestedPriestSource } from '../../lib/requestedPriest';

interface RequestedPriestNoteProps {
    appointment: RequestedPriestSource;
    className?: string;
}

/**
 * Blue "Requested: Fr. ..." chip for an appointment whose parishioner asked for a specific priest at
 * booking. Renders nothing when no priest was requested. It states the preference only; whether the
 * request was honored is visible from the assigned celebrant next to it.
 */
export default function RequestedPriestNote({ appointment, className = '' }: RequestedPriestNoteProps) {
    const label = getRequestedPriestLabel(appointment);
    if (!label) return null;

    return (
        <span
            data-testid="requested-priest"
            className={`inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-800 whitespace-nowrap ${className}`}
        >
            <UserCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
            Requested: {label}
        </span>
    );
}
