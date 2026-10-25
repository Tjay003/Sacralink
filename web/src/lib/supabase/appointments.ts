import type { PostgrestError, RealtimePostgresChangesFilter } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { notifyAdminsOfNewAppointment } from './notifications';
import { uploadDocument } from './documents';
import type { Appointment as DatabaseAppointment } from '../../types/database';

export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';

export interface HydratedAppointment {
    id: string;
    user_id: string;
    church_id: string;
    service_type: string;
    /** The parish service this appointment is for; null only on rows older than the link. */
    service_type_id?: string | null;
    /** Stable kind of that service (for example 'funeral'); it survives a rename. */
    service_kind?: string | null;
    appointment_date: string;
    appointment_time: string;
    notes: string | null;
    status: AppointmentStatus;
    created_at: string;
    updated_at?: string | null;
    priest_id?: string | null;
    requested_priest_id?: string | null;
    admin_feedback?: string | null;
    cancellation_reason?: string | null;
    rescheduled_from_date?: string | null;
    reschedule_reason?: string | null;
    church?: {
        id?: string;
        name: string;
    } | null;
    profile?: {
        id?: string;
        full_name: string | null;
        deleted_at?: string | null;
        email?: string | null;
        phone_number?: string | null;
    } | null;
    priest?: {
        id: string;
        full_name: string | null;
        deleted_at?: string | null;
        email?: string | null;
    } | null;
    /** The priest the parishioner asked for at booking; a preference, not the assignment. */
    requested_priest?: {
        id: string;
        full_name: string | null;
        deleted_at?: string | null;
    } | null;
}

export interface GetAppointmentsFilter {
    churchId?: string | null;
    userId?: string | null;
    priestId?: string | null;
    status?: AppointmentStatus | 'all';
    statusIn?: AppointmentStatus[];
    serviceType?: string;
    dateFrom?: string;
    dateTo?: string;
    searchQuery?: string;
    upcomingOnly?: boolean;
    excludeRejected?: boolean;
    limit?: number;
    orderBy?: 'created_at' | 'appointment_date';
    ascending?: boolean;
    page?: number;
    pageSize?: number;
}

export interface CreateAppointmentInput {
    userId: string;
    churchId: string;
    serviceType: string;
    /** The parish service chosen on the booking form; the database fills it from serviceType when omitted. */
    serviceTypeId?: string | null;
    appointmentDate: string;
    appointmentTime: string;
    notes?: string | null;
    userName?: string;
    documents?: Map<string, File> | Array<{ requirementId: string; file: File }>;
    /** Optional priest of the parish the parishioner asks for; the office still assigns the celebrant. */
    requestedPriestId?: string | null;
}

interface RawAppointmentQueryResult {
    id: string;
    user_id: string;
    church_id: string;
    service_type: string;
    service_type_id?: string | null;
    appointment_date: string;
    appointment_time: string;
    notes: string | null;
    status: AppointmentStatus;
    created_at: string | null;
    updated_at: string | null;
    priest_id?: string | null;
    requested_priest_id?: string | null;
    admin_feedback?: string | null;
    cancellation_reason?: string | null;
    rescheduled_from_date?: string | null;
    reschedule_reason?: string | null;
    church: {
        id: string;
        name: string;
    } | null;
    profile: {
        id: string;
        full_name: string | null;
        deleted_at?: string | null;
        email: string | null;
        phone_number?: string | null;
    } | null;
    priest?: {
        id: string;
        full_name: string | null;
        deleted_at?: string | null;
        email: string | null;
    } | null;
    requested_priest?: {
        id: string;
        full_name: string | null;
        deleted_at?: string | null;
    } | null;
    service?: {
        kind: string | null;
    } | null;
}

/**
 * Converts raw 24-hour time format (HH:MM:SS or HH:MM) into a standard 12-hour AM/PM string.
 */
export function formatAppointmentTime(time: string | null | undefined): string {
    if (!time) return '—';
    const [hourStr, minuteStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    if (isNaN(hour)) return time;
    const minute = minuteStr || '00';
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${period}`;
}

/**
 * Matches service types against standard sacrament keys case-insensitively.
 */
export function matchesSacramentFilter(serviceType: string | null | undefined, filterType: string): boolean {
    if (!filterType || filterType === 'all') return true;
    const type = (serviceType || '').toLowerCase();
    const filterKey = filterType.trim().toLowerCase();
    switch (filterKey) {
        case 'baptism':
            return type.includes('bapt');
        case 'wedding':
        case 'matrimony':
        case 'marriage':
            return type.includes('wed') || type.includes('marri') || type.includes('matrim');
        case 'funeral':
        case 'burial':
            return type.includes('fun') || type.includes('burial');
        case 'confirmation':
            return type.includes('confir');
        case 'mass':
        case 'mass_intention':
            return type.includes('mass') || type.includes('intent');
        case 'anointing':
            return type.includes('anoint') || type.includes('sick');
        case 'confession':
            return type.includes('confess') || type.includes('reconcil');
        case 'counseling':
            return type.includes('counsel') || type.includes('spiritual');
        case 'house_blessing':
        case 'blessing':
            return type.includes('bless');
        case 'other':
            return type.includes('other') || type.includes('custom');
        default:
            return type.includes(filterKey);
    }
}

/**
 * Fetch appointments with standardized joined entities (church name & parishioner profile).
 */
export async function getAppointments(
    filter: GetAppointmentsFilter = {}
): Promise<{ data: HydratedAppointment[]; count: number; error: PostgrestError | Error | null }> {
    try {
        let query = supabase
            .from('appointments')
            .select(`
                *,
                church:churches(id, name),
                profile:profiles!appointments_user_id_fkey(id, full_name, deleted_at, email, phone_number),
                priest:profiles!appointments_priest_id_fkey(id, full_name, deleted_at, email),
                requested_priest:profiles!appointments_requested_priest_id_fkey(id, full_name, deleted_at),
                service:church_service_types!appointments_service_type_id_fkey(kind)
            `, { count: 'exact' });

        // Church scoping filter
        if (filter.churchId && filter.churchId !== 'all') {
            query = query.eq('church_id', filter.churchId);
        }

        // User filter
        if (filter.userId) {
            query = query.eq('user_id', filter.userId);
        }

        // Priest filter
        if (filter.priestId) {
            query = query.eq('priest_id', filter.priestId);
        }

        // Status filter
        if (filter.status && filter.status !== 'all') {
            query = query.eq('status', filter.status);
        } else if (filter.statusIn && filter.statusIn.length > 0) {
            query = query.in('status', filter.statusIn);
        }

        // Exclude rejected filter
        if (filter.excludeRejected) {
            query = query.neq('status', 'rejected');
        }

        // Sacrament / Service Type filter (matches liturgical names & database service type values case-insensitively)
        if (filter.serviceType && filter.serviceType !== 'all') {
            const raw = filter.serviceType.trim().toLowerCase();
            switch (raw) {
                case 'baptism':
                    query = query.ilike('service_type', '%bapt%');
                    break;
                case 'wedding':
                case 'matrimony':
                case 'marriage':
                    query = query.or('service_type.ilike.%wed%,service_type.ilike.%marri%,service_type.ilike.%matrim%');
                    break;
                case 'funeral':
                case 'burial':
                    query = query.or('service_type.ilike.%fun%,service_type.ilike.%burial%');
                    break;
                case 'confirmation':
                    query = query.ilike('service_type', '%confir%');
                    break;
                case 'mass':
                case 'mass_intention':
                    query = query.or('service_type.ilike.%mass%,service_type.ilike.%intent%');
                    break;
                case 'anointing':
                    query = query.or('service_type.ilike.%anoint%,service_type.ilike.%sick%');
                    break;
                case 'confession':
                    query = query.or('service_type.ilike.%confess%,service_type.ilike.%reconcil%');
                    break;
                case 'counseling':
                    query = query.or('service_type.ilike.%counsel%,service_type.ilike.%spiritual%');
                    break;
                case 'house_blessing':
                case 'blessing':
                    query = query.ilike('service_type', '%bless%');
                    break;
                case 'other':
                    query = query.or('service_type.ilike.%other%,service_type.ilike.%custom%');
                    break;
                default:
                    query = query.ilike('service_type', `%${raw}%`);
                    break;
            }
        }

        // Date range filters
        if (filter.dateFrom) {
            query = query.gte('appointment_date', filter.dateFrom);
        }
        if (filter.dateTo) {
            query = query.lte('appointment_date', filter.dateTo);
        }

        // Upcoming filter (today or future)
        if (filter.upcomingOnly) {
            const todayStr = new Date().toISOString().split('T')[0];
            query = query.gte('appointment_date', todayStr);
        }

        // Ordering
        const orderField = filter.orderBy || 'created_at';
        const isAscending = filter.ascending ?? false;
        query = query.order(orderField, { ascending: isAscending });

        if (orderField === 'appointment_date') {
            query = query.order('appointment_time', { ascending: isAscending });
        }

        // Limit
        if (filter.limit) {
            query = query.limit(filter.limit);
        }

        // Pagination range
        if (filter.page && filter.pageSize) {
            const from = (filter.page - 1) * filter.pageSize;
            const to = from + filter.pageSize - 1;
            query = query.range(from, to);
        }

        const { data, count, error } = await query.returns<RawAppointmentQueryResult[]>();

        if (error) {
            console.error('❌ Error fetching appointments:', error);
            return { data: [], count: 0, error };
        }

        let results: HydratedAppointment[] = (data || []).map((row) => ({
            id: row.id,
            user_id: row.user_id,
            church_id: row.church_id,
            service_type: row.service_type,
            service_type_id: row.service_type_id ?? null,
            service_kind: row.service?.kind ?? null,
            appointment_date: row.appointment_date,
            appointment_time: row.appointment_time,
            notes: row.notes,
            status: row.status,
            created_at: row.created_at ?? '',
            updated_at: row.updated_at,
            priest_id: row.priest_id ?? null,
            requested_priest_id: row.requested_priest_id ?? null,
            admin_feedback: row.admin_feedback ?? null,
            cancellation_reason: row.cancellation_reason ?? null,
            rescheduled_from_date: row.rescheduled_from_date ?? null,
            reschedule_reason: row.reschedule_reason ?? null,
            church: row.church ? { id: row.church.id, name: row.church.name } : null,
            profile: row.profile ? { id: row.profile.id, full_name: row.profile.full_name, deleted_at: row.profile.deleted_at ?? null, email: row.profile.email, phone_number: row.profile.phone_number } : null,
            priest: row.priest ? { id: row.priest.id, full_name: row.priest.full_name, deleted_at: row.priest.deleted_at ?? null, email: row.priest.email } : null,
            requested_priest: row.requested_priest ? { id: row.requested_priest.id, full_name: row.requested_priest.full_name, deleted_at: row.requested_priest.deleted_at ?? null } : null,
        }));

        // In-memory verification for service type filter (ensures accuracy for custom variations)
        if (filter.serviceType && filter.serviceType !== 'all') {
            results = results.filter((item) => matchesSacramentFilter(item.service_type, filter.serviceType!));
        }

        // Search query filter (by parishioner name, service type, notes, or church name)
        if (filter.searchQuery && filter.searchQuery.trim() !== '') {
            const term = filter.searchQuery.toLowerCase().trim();
            results = results.filter((item) => {
                const name = item.profile?.full_name?.toLowerCase() || '';
                const service = item.service_type?.toLowerCase() || '';
                const church = item.church?.name?.toLowerCase() || '';
                const notes = item.notes?.toLowerCase() || '';
                return name.includes(term) || service.includes(term) || church.includes(term) || notes.includes(term);
            });
        }

        return { data: results, count: count ?? results.length, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Exception in getAppointments:', error);
        return { data: [], count: 0, error };
    }
}

/**
 * Fetch a single appointment by ID.
 */
export async function getAppointmentById(
    id: string
): Promise<{ data: HydratedAppointment | null; error: PostgrestError | Error | null }> {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                church:churches(id, name),
                profile:profiles!appointments_user_id_fkey(id, full_name, deleted_at, email, phone_number),
                priest:profiles!appointments_priest_id_fkey(id, full_name, deleted_at, email),
                requested_priest:profiles!appointments_requested_priest_id_fkey(id, full_name, deleted_at),
                service:church_service_types!appointments_service_type_id_fkey(kind)
            `)
            .eq('id', id)
            .single()
            .returns<RawAppointmentQueryResult>();

        if (error) return { data: null, error };
        if (!data) return { data: null, error: new Error('Appointment not found') };

        const appointment: HydratedAppointment = {
            id: data.id,
            user_id: data.user_id,
            church_id: data.church_id,
            service_type: data.service_type,
            service_type_id: data.service_type_id ?? null,
            service_kind: data.service?.kind ?? null,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            notes: data.notes,
            status: data.status,
            created_at: data.created_at ?? '',
            updated_at: data.updated_at,
            priest_id: data.priest_id ?? null,
            requested_priest_id: data.requested_priest_id ?? null,
            admin_feedback: data.admin_feedback ?? null,
            church: data.church ? { id: data.church.id, name: data.church.name } : null,
            profile: data.profile ? { id: data.profile.id, full_name: data.profile.full_name, deleted_at: data.profile.deleted_at ?? null, email: data.profile.email, phone_number: data.profile.phone_number } : null,
            priest: data.priest ? { id: data.priest.id, full_name: data.priest.full_name, deleted_at: data.priest.deleted_at ?? null, email: data.priest.email } : null,
            requested_priest: data.requested_priest ? { id: data.requested_priest.id, full_name: data.requested_priest.full_name, deleted_at: data.requested_priest.deleted_at ?? null } : null,
        };

        return { data: appointment, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { data: null, error };
    }
}

/**
 * Approves a pending appointment through the approve_appointment database function (parish office
 * only). The optional celebrant and office note are saved with the approval; the function records the
 * Appointment Change and notifies the parishioner (approved) and the assigned celebrant in one transaction.
 */
export async function approveAppointment(
    id: string,
    priestId: string | null = null,
    adminFeedback: string | null = null
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const { error } = await supabase.rpc('approve_appointment', {
        p_appointment_id: id,
        p_priest_id: priestId,
        p_admin_feedback: adminFeedback,
    });
    if (error) {
        console.error('❌ Error approving appointment:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

/**
 * Rejects a pending appointment through the reject_appointment database function (parish office
 * only). The function records the Appointment Change and notifies the parishioner (rejected).
 */
export async function rejectAppointment(
    id: string,
    adminFeedback: string | null = null
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const { error } = await supabase.rpc('reject_appointment', {
        p_appointment_id: id,
        p_admin_feedback: adminFeedback,
    });
    if (error) {
        console.error('❌ Error rejecting appointment:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

/**
 * Cancels an approved appointment through the cancel_appointment database function.
 * The function validates the caller (parish office) and the reason, records the Appointment
 * Change and notifies the parishioner and current celebrant in a single transaction.
 */
export async function cancelAppointment(
    id: string,
    reason: string
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return { success: false, error: new Error('A reason is required to cancel an appointment.') };
    }
    const { error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: id,
        p_reason: trimmedReason,
    });
    if (error) {
        console.error('❌ Error cancelling appointment:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

/**
 * Assigns or changes the presiding celebrant of an approved appointment (office only).
 * Goes through the change_appointment_celebrant database function, which validates the caller and
 * the new priest, records the Appointment Change and notifies only the new and the removed
 * celebrant (the parishioner is not re-notified) in a single transaction.
 */
export async function changeAppointmentCelebrant(
    id: string,
    newPriestId: string,
    reason: string
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return { success: false, error: new Error('A reason is required to change the celebrant.') };
    }
    if (!newPriestId) {
        return { success: false, error: new Error('Please choose a celebrant.') };
    }
    const { error } = await supabase.rpc('change_appointment_celebrant', {
        p_appointment_id: id,
        p_new_priest_id: newPriestId,
        p_reason: trimmedReason,
    });
    if (error) {
        console.error('❌ Error changing appointment celebrant:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

/**
 * Moves an approved appointment to a new date and time, optionally switching the celebrant in the
 * same save (office only). Goes through the reschedule_appointment database function, which rejects
 * past dates, keeps the status approved, records ONE Appointment Change row (action 'reschedule',
 * with priest_id in before/after when the celebrant changed) and notifies the parishioner and the
 * celebrant(s) in a single transaction. Availability conflicts are warnings in the UI, not enforced here.
 */
export async function rescheduleAppointment(
    id: string,
    newDate: string,
    newTime: string,
    reason: string,
    newPriestId?: string | null
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return { success: false, error: new Error('A reason is required to reschedule an appointment.') };
    }
    if (!newDate || !newTime) {
        return { success: false, error: new Error('Please choose a new date and time.') };
    }
    const { error } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: id,
        p_new_date: newDate,
        p_new_time: newTime,
        p_reason: trimmedReason,
        p_new_priest_id: newPriestId || null,
    });
    if (error) {
        console.error('❌ Error rescheduling appointment:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

/**
 * Restores a Cancelled or Celebrated appointment to approved through the restore_appointment
 * database function (office only, reason required). The function records the Appointment Change
 * and, for a cancellation, notifies the parishioner and the celebrant.
 */
export async function restoreAppointment(
    id: string,
    reason: string
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return { success: false, error: new Error('A reason is required to restore an appointment.') };
    }
    const { error } = await supabase.rpc('restore_appointment', {
        p_appointment_id: id,
        p_reason: trimmedReason,
    });
    if (error) {
        console.error('❌ Error restoring appointment:', error);
        return { success: false, error };
    }
    return { success: true, error: null };
}

export type AppointmentChangeAction =
    | 'reschedule'
    | 'change_celebrant'
    | 'cancel'
    | 'mark_celebrated'
    | 'restore'
    | 'approve'
    | 'reject';

/** One Appointment Change history row, with the actor and any celebrants already resolved to display names. */
export interface AppointmentChange {
    id: string;
    appointment_id: string;
    action: AppointmentChangeAction;
    reason: string | null;
    before_values: Record<string, unknown>;
    after_values: Record<string, unknown>;
    changed_by: string | null;
    /** Display name of whoever made the change; "Staff" when it cannot be read. */
    changed_by_name: string;
    /** True when the actor's account has been deleted. */
    changed_by_deleted: boolean;
    /** Celebrant ids in celebrant_names whose accounts have been deleted. */
    deleted_celebrant_ids: string[];
    created_at: string;
    /** Display names keyed by profile id, for the priest_id values in before_values and after_values. */
    celebrant_names: Record<string, string>;
}

/**
 * Fetches the change history of one appointment, newest first. Row access is enforced by RLS
 * (parish office, super admin and the appointment's current celebrant only; parishioners get no rows).
 * Names are resolved in one extra profiles query; if that fails the history still loads with fallback names.
 */
export async function fetchAppointmentChanges(
    appointmentId: string
): Promise<{ data: AppointmentChange[]; error: PostgrestError | Error | null }> {
    const { data, error } = await supabase
        .from('appointment_changes')
        .select('id, appointment_id, action, reason, before_values, after_values, changed_by, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('❌ Error loading appointment changes:', error);
        return { data: [], error };
    }

    const rows = data ?? [];
    const profileIds = new Set<string>();
    for (const row of rows) {
        if (row.changed_by) profileIds.add(row.changed_by);
        for (const values of [row.before_values, row.after_values]) {
            const priestId = (values as Record<string, unknown> | null)?.priest_id;
            if (typeof priestId === 'string') profileIds.add(priestId);
        }
    }

    const names = new Map<string, string>();
    const deletedIds = new Set<string>();
    if (profileIds.size > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, deleted_at')
            .in('id', Array.from(profileIds));
        for (const profile of profiles ?? []) {
            if (profile.deleted_at) {
                deletedIds.add(profile.id);
                names.set(profile.id, 'Deleted User');
            } else if (profile.full_name) names.set(profile.id, profile.full_name);
        }
    }

    const changes = rows.map((row): AppointmentChange => {
        const before = (row.before_values ?? {}) as Record<string, unknown>;
        const after = (row.after_values ?? {}) as Record<string, unknown>;
        const celebrantNames: Record<string, string> = {};
        for (const values of [before, after]) {
            const priestId = values.priest_id;
            if (typeof priestId === 'string' && names.has(priestId)) celebrantNames[priestId] = names.get(priestId) as string;
        }
        return {
            id: row.id,
            appointment_id: row.appointment_id,
            action: row.action as AppointmentChangeAction,
            reason: row.reason ?? null,
            before_values: before,
            after_values: after,
            changed_by: row.changed_by ?? null,
            changed_by_name: (row.changed_by && names.get(row.changed_by)) || 'Staff',
            changed_by_deleted: !!row.changed_by && deletedIds.has(row.changed_by),
            deleted_celebrant_ids: Object.keys(celebrantNames).filter((id) => deletedIds.has(id)),
            created_at: row.created_at,
            celebrant_names: celebrantNames,
        };
    });
    return { data: changes, error: null };
}

/** Fired on window after an appointment is marked Celebrated, so other widgets on the page can refresh without a reload. */
export const APPOINTMENT_CELEBRATED_EVENT = 'sacralink:appointment-celebrated';

/**
 * Marks an approved appointment Celebrated (stored as status 'completed') through the
 * mark_appointment_celebrated database function. The office can mark any appointment of its parish;
 * a priest can mark only his own, once it has started. The note is optional, the Appointment Change
 * is recorded in the same transaction and nobody is notified.
 */
export async function markAppointmentCelebrated(
    id: string,
    note?: string | null
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    const { error } = await supabase.rpc('mark_appointment_celebrated', {
        p_appointment_id: id,
        p_note: note?.trim() || null,
    });
    if (error) {
        console.error('❌ Error marking appointment celebrated:', error);
        return { success: false, error };
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(APPOINTMENT_CELEBRATED_EVENT, { detail: { id } }));
    }
    return { success: true, error: null };
}

/**
 * True once an appointment's start (its local date and time) has passed. The priest's "Mark celebrated"
 * actions use this; the database function applies a deliberately lenient version of the same rule.
 */
export function hasAppointmentStarted(
    appointment: Pick<HydratedAppointment, 'appointment_date' | 'appointment_time'>,
    now: Date = new Date()
): boolean {
    const [year, month, day] = appointment.appointment_date.split('T')[0].split('-').map(Number);
    const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i.exec((appointment.appointment_time || '').trim());
    if (!timeMatch) return false;
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const meridiem = timeMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (!year || !month || !day) return false;
    return new Date(year, month - 1, day, hours, minutes).getTime() <= now.getTime();
}

/**
 * Creates an appointment with required document uploads and admin notifications encapsulated.
 */
export async function createAppointmentWithDocuments(
    input: CreateAppointmentInput
): Promise<{ data: DatabaseAppointment | null; error: PostgrestError | Error | null }> {
    try {
        // 1. Insert appointment record
        const { data: appointment, error: insertError } = await supabase
            .from('appointments')
            .insert({
                user_id: input.userId,
                church_id: input.churchId,
                service_type: input.serviceType,
                service_type_id: input.serviceTypeId ?? null,
                appointment_date: input.appointmentDate,
                appointment_time: input.appointmentTime,
                notes: input.notes || null,
                status: 'pending',
                requested_priest_id: input.requestedPriestId || null,
            })
            .select()
            .single();

        if (insertError) throw insertError;
        if (!appointment) throw new Error('Failed to create appointment');

        // 2. Upload documents if provided
        if (input.documents) {
            const docEntries = input.documents instanceof Map
                ? Array.from(input.documents.entries()).map(([reqId, file]) => ({ requirementId: reqId, file }))
                : input.documents;

            const uploadPromises = docEntries.map(({ requirementId, file }) =>
                uploadDocument(appointment.id, requirementId, file)
            );

            await Promise.all(uploadPromises);
        }

        // 3. Notify parish / church admins
        try {
            await notifyAdminsOfNewAppointment(
                input.churchId,
                input.userName || 'A parishioner',
                input.serviceType,
                appointment.id
            );
        } catch (notifErr) {
            console.warn('⚠️ Non-fatal admin notification error:', notifErr);
        }

        return { data: appointment, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Error in createAppointmentWithDocuments:', error);
        return { data: null, error };
    }
}

/**
 * Quick count helper for dashboard statistics (pending and upcoming approved appointments).
 */
export async function getDashboardAppointmentCounts(churchId?: string | null): Promise<{
    pendingCount: number;
    upcomingApprovedCount: number;
}> {
    try {
        let pendingQuery = supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        const todayStr = new Date().toISOString().split('T')[0];
        let upcomingQuery = supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
            .gte('appointment_date', todayStr);

        if (churchId && churchId !== 'all') {
            pendingQuery = pendingQuery.eq('church_id', churchId);
            upcomingQuery = upcomingQuery.eq('church_id', churchId);
        }

        const [{ count: pendingCount }, { count: upcomingApprovedCount }] = await Promise.all([
            pendingQuery,
            upcomingQuery,
        ]);

        return {
            pendingCount: pendingCount || 0,
            upcomingApprovedCount: upcomingApprovedCount || 0,
        };
    } catch (err) {
        console.error('Error fetching dashboard appointment counts:', err);
        return { pendingCount: 0, upcomingApprovedCount: 0 };
    }
}

/**
 * Subscribes to real-time changes on the appointments table, returning a clean teardown function.
 */
export function subscribeToAppointments(
    filter: { churchId?: string; userId?: string; priestId?: string } | undefined,
    onUpdate: () => void
): () => void {
    const channelName = `appointments-realtime-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    let filterClause: string | undefined;
    if (filter?.churchId && filter.churchId !== 'all') {
        filterClause = `church_id=eq.${filter.churchId}`;
    } else if (filter?.userId) {
        filterClause = `user_id=eq.${filter.userId}`;
    } else if (filter?.priestId) {
        filterClause = `priest_id=eq.${filter.priestId}`;
    }

    const channelConfig: RealtimePostgresChangesFilter<'*'> = {
        event: '*',
        schema: 'public',
        table: 'appointments',
        ...(filterClause ? { filter: filterClause } : {}),
    };

    const channel = supabase
        .channel(channelName)
        .on('postgres_changes', channelConfig, () => {
            onUpdate();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}


// ============================================================================
// Booking Validation Rules (Pure Functions)
// ============================================================================

export const SLOT_UNAVAILABLE_ERROR_MESSAGE =
    'The selected slot is unavailable. Please select an alternative slot or change the date and time.';

export const PAST_DATE_ERROR_MESSAGE = 'Appointment date must be today or in the future.';

export interface BookingRequirementLike {
    id: string;
    requirement_name: string;
    is_required?: boolean | null;
}

export type AttachedDocumentsInput =
    | Map<string, unknown>
    | Array<{ requirementId: string } | string>
    | Record<string, unknown>
    | Set<string>
    | null
    | undefined;

export type SlotAvailabilityInput =
    | { isAvailable?: boolean | null }
    | boolean
    | null
    | undefined;

export interface BookingValidationResult {
    ok: boolean;
    valid: boolean;
    error?: string;
    problems: string[];
}

/**
 * Checks if a document has been provided for a given requirement ID.
 * Supports Map, Set, Array of objects with requirementId, Array of requirement IDs, and Record objects.
 */
function hasAttachedDocument(documents: AttachedDocumentsInput, requirementId: string): boolean {
    if (!documents) return false;
    if (documents instanceof Map) {
        const val = documents.get(requirementId);
        return documents.has(requirementId) && val !== null && val !== undefined && val !== '';
    }
    if (documents instanceof Set) {
        return documents.has(requirementId);
    }
    if (Array.isArray(documents)) {
        return documents.some((item) => {
            if (typeof item === 'string') return item === requirementId;
            return item && typeof item === 'object' && 'requirementId' in item && item.requirementId === requirementId;
        });
    }
    if (typeof documents === 'object') {
        const val = (documents as Record<string, unknown>)[requirementId];
        return val !== null && val !== undefined && val !== '';
    }
    return false;
}

/**
 * Pure validation function for required documents.
 * Returns { ok: true, valid: true, problems: [] } when all required documents are attached or testing bypass is active.
 * If any required document is missing, returns the exact error message:
 * `Missing required document: ${req.requirement_name}`
 */
export function validateRequiredDocuments(
    requirements: BookingRequirementLike[],
    documents?: AttachedDocumentsInput,
    options?: { bypassDocsForTesting?: boolean }
): BookingValidationResult {
    if (options?.bypassDocsForTesting) {
        return { ok: true, valid: true, problems: [] };
    }

    const requiredReqs = (requirements || []).filter((r) => Boolean(r?.is_required));
    const problems: string[] = [];

    for (const req of requiredReqs) {
        if (!hasAttachedDocument(documents, req.id)) {
            problems.push(`Missing required document: ${req.requirement_name}`);
        }
    }

    const ok = problems.length === 0;
    return {
        ok,
        valid: ok,
        ...(ok ? {} : { error: problems[0] }),
        problems,
    };
}

/**
 * Pure validation function for slot availability.
 * If unavailable, returns the exact error message:
 * `The selected slot is unavailable. Please select an alternative slot or change the date and time.`
 */
export function validateSlotAvailability(
    availability: SlotAvailabilityInput
): BookingValidationResult {
    const isUnavailable =
        availability === false ||
        (typeof availability === 'object' && availability !== null && availability.isAvailable === false);

    if (isUnavailable) {
        return {
            ok: false,
            valid: false,
            error: SLOT_UNAVAILABLE_ERROR_MESSAGE,
            problems: [SLOT_UNAVAILABLE_ERROR_MESSAGE],
        };
    }

    return { ok: true, valid: true, problems: [] };
}

/**
 * Validates that an appointment date (YYYY-MM-DD) is today or in the future.
 * Matches the HTML date input min={new Date().toISOString().split('T')[0]} enforcement.
 */
export function validateFutureDate(
    dateStr: string | null | undefined,
    _timeStr?: string | null | undefined,
    now: Date = new Date()
): BookingValidationResult {
    if (!dateStr || !dateStr.trim()) {
        const error = 'Please select an appointment date.';
        return { ok: false, valid: false, error, problems: [error] };
    }

    const cleanDate = dateStr.trim().split('T')[0];
    const parts = cleanDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        const error = 'Invalid appointment date format.';
        return { ok: false, valid: false, error, problems: [error] };
    }

    const [year, month, day] = parts;
    const dateEndOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (dateEndOfDay.getTime() < now.getTime()) {
        return {
            ok: false,
            valid: false,
            error: PAST_DATE_ERROR_MESSAGE,
            problems: [PAST_DATE_ERROR_MESSAGE],
        };
    }

    return { ok: true, valid: true, problems: [] };
}

export interface ValidateBookingSubmissionInput {
    appointmentDate?: string | null;
    appointmentTime?: string | null;
    requirements?: BookingRequirementLike[];
    documents?: AttachedDocumentsInput;
    availability?: SlotAvailabilityInput;
    bypassDocsForTesting?: boolean;
}

/**
 * High-level composite validator for appointment booking submission.
 * Enforces:
 * 1. Date is today or in the future
 * 2. Slot is available
 * 3. Required documents are attached (unless testing bypass is active)
 *
 * Returns { ok: boolean; valid: boolean; error?: string; problems: string[] }.
 */
export function validateBookingSubmission(
    input: ValidateBookingSubmissionInput,
    now: Date = new Date()
): BookingValidationResult {
    const problems: string[] = [];

    // 1. Future date check
    if (input.appointmentDate !== undefined && input.appointmentDate !== null) {
        const dateRes = validateFutureDate(input.appointmentDate, input.appointmentTime, now);
        if (!dateRes.ok && dateRes.error) {
            problems.push(...dateRes.problems);
        }
    }

    // 2. Slot availability check
    if (input.availability !== undefined) {
        const slotRes = validateSlotAvailability(input.availability);
        if (!slotRes.ok && slotRes.error) {
            problems.push(...slotRes.problems);
        }
    }

    // 3. Required documents check
    if (input.requirements !== undefined) {
        const docsRes = validateRequiredDocuments(input.requirements, input.documents, {
            bypassDocsForTesting: input.bypassDocsForTesting,
        });
        if (!docsRes.ok && docsRes.error) {
            problems.push(...docsRes.problems);
        }
    }

    const ok = problems.length === 0;
    return {
        ok,
        valid: ok,
        ...(ok ? {} : { error: problems[0] }),
        problems,
    };
}
