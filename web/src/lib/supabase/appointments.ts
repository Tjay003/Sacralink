import type { PostgrestError, RealtimePostgresChangesFilter } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { notifyUserOfStatusChange, notifyAdminsOfNewAppointment } from './notifications';
import { uploadDocument } from './documents';
import type { Appointment as DatabaseAppointment } from '../../types/database';

export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';

export interface HydratedAppointment {
    id: string;
    user_id: string;
    church_id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    notes: string | null;
    status: AppointmentStatus;
    created_at: string;
    updated_at?: string | null;
    church?: {
        id?: string;
        name: string;
    } | null;
    profile?: {
        id?: string;
        full_name: string | null;
        email?: string | null;
    } | null;
}

export interface GetAppointmentsFilter {
    churchId?: string | null;
    userId?: string | null;
    status?: AppointmentStatus | 'all';
    serviceType?: string;
    dateFrom?: string;
    dateTo?: string;
    searchQuery?: string;
    upcomingOnly?: boolean;
    excludeRejected?: boolean;
    limit?: number;
    orderBy?: 'created_at' | 'appointment_date';
    ascending?: boolean;
}

export interface CreateAppointmentInput {
    userId: string;
    churchId: string;
    serviceType: string;
    appointmentDate: string;
    appointmentTime: string;
    notes?: string | null;
    userName?: string;
    documents?: Map<string, File> | Array<{ requirementId: string; file: File }>;
}

interface RawAppointmentQueryResult {
    id: string;
    user_id: string;
    church_id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    notes: string | null;
    status: AppointmentStatus;
    created_at: string | null;
    updated_at: string | null;
    church: {
        id: string;
        name: string;
    } | null;
    profile: {
        id: string;
        full_name: string | null;
        email: string | null;
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
 * Fetch appointments with standardized joined entities (church name & parishioner profile).
 */
export async function getAppointments(
    filter: GetAppointmentsFilter = {}
): Promise<{ data: HydratedAppointment[]; error: PostgrestError | Error | null }> {
    try {
        let query = supabase
            .from('appointments')
            .select(`
                *,
                church:churches(id, name),
                profile:profiles(id, full_name, email)
            `);

        // Church scoping filter
        if (filter.churchId && filter.churchId !== 'all') {
            query = query.eq('church_id', filter.churchId);
        }

        // User filter
        if (filter.userId) {
            query = query.eq('user_id', filter.userId);
        }

        // Status filter
        if (filter.status && filter.status !== 'all') {
            query = query.eq('status', filter.status);
        }

        // Exclude rejected filter
        if (filter.excludeRejected) {
            query = query.neq('status', 'rejected');
        }

        // Sacrament / Service Type filter
        if (filter.serviceType && filter.serviceType !== 'all') {
            query = query.eq('service_type', filter.serviceType);
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

        const { data, error } = await query.returns<RawAppointmentQueryResult[]>();

        if (error) {
            console.error('❌ Error fetching appointments:', error);
            return { data: [], error };
        }

        let results: HydratedAppointment[] = (data || []).map((row) => ({
            id: row.id,
            user_id: row.user_id,
            church_id: row.church_id,
            service_type: row.service_type,
            appointment_date: row.appointment_date,
            appointment_time: row.appointment_time,
            notes: row.notes,
            status: row.status,
            created_at: row.created_at ?? '',
            updated_at: row.updated_at,
            church: row.church ? { id: row.church.id, name: row.church.name } : null,
            profile: row.profile ? { id: row.profile.id, full_name: row.profile.full_name, email: row.profile.email } : null,
        }));

        // Search query filter (by parishioner name or service type)
        if (filter.searchQuery && filter.searchQuery.trim() !== '') {
            const term = filter.searchQuery.toLowerCase().trim();
            results = results.filter(item => {
                const name = item.profile?.full_name?.toLowerCase() || '';
                const service = item.service_type?.toLowerCase() || '';
                const church = item.church?.name?.toLowerCase() || '';
                return name.includes(term) || service.includes(term) || church.includes(term);
            });
        }

        return { data: results, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Exception in getAppointments:', error);
        return { data: [], error };
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
                profile:profiles(id, full_name, email)
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
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            notes: data.notes,
            status: data.status,
            created_at: data.created_at ?? '',
            updated_at: data.updated_at,
            church: data.church ? { id: data.church.id, name: data.church.name } : null,
            profile: data.profile ? { id: data.profile.id, full_name: data.profile.full_name, email: data.profile.email } : null,
        };

        return { data: appointment, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { data: null, error };
    }
}

/**
 * Updates an appointment's status and automatically dispatches parishioner notifications.
 */
export async function updateAppointmentStatus(
    id: string,
    newStatus: AppointmentStatus,
    metadata?: { serviceType?: string; userId?: string }
): Promise<{ success: boolean; error: PostgrestError | Error | null }> {
    try {
        let userId = metadata?.userId;
        let serviceType = metadata?.serviceType;

        // If metadata is not supplied, fetch appointment details to notify the correct user
        if (!userId || !serviceType) {
            const { data: existing } = await getAppointmentById(id);
            if (existing) {
                userId = existing.user_id;
                serviceType = existing.service_type;
            }
        }

        const { error } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;

        // Automatically dispatch notification on approval or rejection
        if (userId && serviceType && (newStatus === 'approved' || newStatus === 'rejected')) {
            try {
                await notifyUserOfStatusChange(userId, serviceType, newStatus, id);
            } catch (notifErr) {
                console.warn('⚠️ Non-fatal notification error on status update:', notifErr);
            }
        }

        return { success: true, error: null };
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('❌ Error updating appointment status:', error);
        return { success: false, error };
    }
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
                appointment_date: input.appointmentDate,
                appointment_time: input.appointmentTime,
                notes: input.notes || null,
                status: 'pending',
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
    filter: { churchId?: string; userId?: string } | undefined,
    onUpdate: () => void
): () => void {
    const channelName = `appointments-realtime-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    let filterClause: string | undefined;
    if (filter?.churchId && filter.churchId !== 'all') {
        filterClause = `church_id=eq.${filter.churchId}`;
    } else if (filter?.userId) {
        filterClause = `user_id=eq.${filter.userId}`;
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
