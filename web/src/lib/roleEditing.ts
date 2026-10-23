import type { Profile, UserRole } from '../types/database';

/** The four roles a Super Admin or Church Admin may assign (the database enforces the same list). */
export const ASSIGNABLE_ROLES: UserRole[] = ['user', 'volunteer', 'priest', 'church_admin'];

/** Roles that count as church staff: demoting one of these returns the person to Parishioner. */
const STAFF_ROLES: UserRole[] = ['volunteer', 'priest', 'church_admin'];

export function isStaffRole(role: UserRole | null | undefined): boolean {
    return !!role && STAFF_ROLES.includes(role);
}

export function roleLabel(role: UserRole | null | undefined): string {
    switch (role) {
        case 'church_admin': return 'Church Admin';
        case 'priest': return 'Priest';
        case 'volunteer': return 'Volunteer';
        case 'super_admin': return 'Super Admin';
        default: return 'Parishioner';
    }
}

/** The church a person belongs to: where they serve (staff) or, for a Parishioner, their home church. */
export function effectiveChurchId(person: Pick<Profile, 'assigned_church_id' | 'church_id'>): string | null {
    return person.assigned_church_id || person.church_id || null;
}

/**
 * Who a Church Admin sees in the directory: staff of their own church, Parishioners whose home church is
 * theirs, and Parishioners with no church at all. Never the Super Admin, other churches' staff or their Parishioners.
 */
export function isVisibleToChurchAdmin(target: Profile, churchId: string | null | undefined): boolean {
    if (target.role === 'super_admin') return false;
    if (target.assigned_church_id) return !!churchId && target.assigned_church_id === churchId;
    if (target.role && target.role !== 'user') return false;
    return !target.church_id || (!!churchId && target.church_id === churchId);
}

/**
 * What the database function set_user_role lets a Church Admin change: people assigned to their church, and any
 * Parishioner without an assigned church (whatever their home church). This is wider than what the directory shows.
 */
function churchAdminMayChangeRole(target: Profile, churchId: string): boolean {
    if (target.assigned_church_id) return target.assigned_church_id === churchId;
    return !target.role || target.role === 'user';
}

/**
 * Why the current user cannot edit this person's role, or null when they can.
 * Mirrors the rules in the database function set_user_role so the UI explains instead of failing.
 */
export function getRoleEditBlock(current: Profile | null | undefined, target: Profile): string | null {
    if (!current) return 'You are not signed in.';
    if (target.id === current.id) return 'You cannot change your own role.';
    if (target.role === 'super_admin') return 'The Super Admin role can only be moved with Transfer Ownership.';
    if (current.role === 'super_admin') return null;
    if (current.role === 'church_admin') {
        const ownChurch = current.assigned_church_id || current.church_id;
        if (!ownChurch) return 'You are not assigned to a church.';
        if (!churchAdminMayChangeRole(target, ownChurch)) return 'This person belongs to another church.';
        return null;
    }
    return 'Only a Super Admin or a Church Admin can change roles.';
}

/** Confirmation text for turning a staff member back into a Parishioner. */
export function demotionMessage(name: string, churchName: string | null): string {
    const place = churchName ? ` and stay in ${churchName}` : '';
    return `${name} will become a Parishioner${place}. They lose staff access, leave the church staff channel, and tickets assigned to them go back to the Church Admin. Their own open tickets to the Super Admin stay open.`;
}
