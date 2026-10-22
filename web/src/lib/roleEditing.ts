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

/** A Church Admin can work with their own church's people and with Parishioners who have no church yet. */
export function isVisibleToChurchAdmin(target: Profile, churchId: string | null | undefined): boolean {
    if (target.role === 'super_admin') return false;
    const churchOfTarget = target.assigned_church_id || null;
    if (churchOfTarget) return !!churchId && churchOfTarget === churchId;
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
        if (!current.assigned_church_id) return 'You are not assigned to a church.';
        if (!isVisibleToChurchAdmin(target, current.assigned_church_id)) return 'This person belongs to another church.';
        return null;
    }
    return 'Only a Super Admin or a Church Admin can change roles.';
}

/** Confirmation text for turning a staff member back into a Parishioner. */
export function demotionMessage(name: string, churchName: string | null): string {
    const place = churchName ? ` and stay in ${churchName}` : '';
    return `${name} will become a Parishioner${place}. They lose staff access, leave the church staff channel, and tickets assigned to them go back to the Church Admin. Their own open tickets to the Super Admin stay open.`;
}
