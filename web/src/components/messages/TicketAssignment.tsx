import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useToast } from '../../contexts/toastContext';
import { supabase } from '../../lib/supabase';
import { assignTicket } from '../../lib/supabase/messaging';
import { getChurchTicketStaff } from '../../lib/supabase/profiles';

interface TicketAssignmentProps {
    ticketId: string;
    churchId: string | null;
    assignedTo: string | null;
    /** True for the Church Admin who handles this ticket and may still assign it. */
    canAssign: boolean;
    /** Called after a successful assign or unassign so the list can reload. */
    onChanged: () => void | Promise<void>;
}

type StaffOption = { id: string; full_name: string | null; role: string | null };

/**
 * Who handles a church ticket. Everyone who can read the ticket sees the name (or "Unassigned"); the Church Admin
 * also gets a picker of the church's Priests and Volunteers. The database decides every assignment.
 */
export default function TicketAssignment({ ticketId, churchId, assignedTo, canAssign, onChanged }: TicketAssignmentProps) {
    const toast = useToast();
    const [assigneeName, setAssigneeName] = useState<string | null>(null);
    const [staff, setStaff] = useState<StaffOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!assignedTo) return;
        supabase
            .from('profiles')
            .select('full_name')
            .eq('id', assignedTo)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setAssigneeName(data?.full_name?.trim() || 'a staff member');
            });
        return () => {
            cancelled = true;
        };
    }, [assignedTo]);

    useEffect(() => {
        let cancelled = false;
        if (!canAssign || !churchId) return;
        getChurchTicketStaff(churchId)
            .then((rows) => {
                if (!cancelled) setStaff(rows);
            })
            .catch(() => {
                if (!cancelled) setStaff([]);
            });
        return () => {
            cancelled = true;
        };
    }, [canAssign, churchId]);

    const handleChange = async (value: string) => {
        setSaving(true);
        setError(null);
        const { error: assignError } = await assignTicket(ticketId, value || null);
        if (assignError) {
            setError(assignError.message);
            toast.error(assignError.message);
        } else {
            const chosen = staff.find((person) => person.id === value);
            toast.success(value ? `Ticket assigned to ${chosen?.full_name?.trim() || 'the selected staff member'}.` : 'Ticket unassigned. It is back with the Church Admin.');
            await onChanged();
        }
        setSaving(false);
    };

    return (
        <div
            data-testid="ticket-assignment"
            className="px-3 sm:px-4 py-2.5 border-b border-border/70 bg-secondary-50/40 shrink-0 flex flex-wrap items-center justify-between gap-2 min-w-0"
        >
            <p className="text-xs font-medium text-secondary-600 inline-flex items-center gap-1.5 min-w-0 max-w-full">
                <UserCheck className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                <span data-testid="ticket-assignee" className="truncate">
                    {assignedTo ? `Assigned to ${assigneeName ?? '...'}` : 'Unassigned (Church Admin)'}
                </span>
            </p>
            {canAssign && (
                <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:max-w-[65%]">
                    <label htmlFor="ticket-assign-select" className="text-xs text-secondary-500 shrink-0">
                        Assign
                    </label>
                    <select
                        id="ticket-assign-select"
                        data-testid="ticket-assign-select"
                        disabled={saving}
                        value={assignedTo ?? ''}
                        onChange={(e) => handleChange(e.target.value)}
                        className="text-xs font-semibold py-2 min-h-10 pl-2.5 pr-7 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 min-w-0 flex-1 w-full truncate"
                    >
                        <option value="">Unassigned (Church Admin)</option>
                        {staff.map((person) => (
                            <option key={person.id} value={person.id}>
                                {`${person.full_name?.trim() || 'Unnamed'} (${person.role === 'priest' ? 'Priest' : 'Volunteer'})`}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {error && (
                <p role="alert" className="text-xs font-medium text-red-600 sm:basis-full">
                    {error}
                </p>
            )}
        </div>
    );
}
