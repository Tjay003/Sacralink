import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserNameProps {
    /** The person's name as stored; ignored for a deleted account. */
    name?: string | null;
    /** `profiles.deleted_at`; when set the account is a Deleted User. */
    deletedAt?: string | null;
    /** Shown when there is no name and the account is not deleted. */
    fallback?: string;
    className?: string;
}

/**
 * Renders a person's name. A deleted account shows "Deleted User" with a small red warning icon whose tooltip
 * ("Deleted user") opens on hover and on keyboard focus. A suspended account is not deleted and keeps its real name.
 */
export function UserName({ name, deletedAt, fallback = 'Unknown', className }: UserNameProps) {
    if (!deletedAt) {
        return <span className={className}>{name?.trim() || fallback}</span>;
    }
    return (
        <span className={cn('inline-flex items-center gap-1 max-w-full align-middle', className)}>
            <span className="truncate">Deleted User</span>
            <span className="relative inline-flex group/deleted shrink-0">
                <span
                    role="img"
                    tabIndex={0}
                    aria-label="Deleted user"
                    className="inline-flex rounded text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                >
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover/deleted:opacity-100 group-focus-within/deleted:opacity-100"
                >
                    Deleted user
                </span>
            </span>
        </span>
    );
}
