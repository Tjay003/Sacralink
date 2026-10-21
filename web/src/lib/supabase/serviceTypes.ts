import { supabase } from '../supabase';
import type { Database } from '../../types/database';

export type ServiceType = Database['public']['Tables']['church_service_types']['Row'];
export type ServiceTypeUpdate = Pick<
    Database['public']['Tables']['church_service_types']['Update'],
    'name' | 'description' | 'display_order' | 'is_hidden'
>;

/** Postgres unique violation: the name is already used by another service of the parish. */
const UNIQUE_VIOLATION = '23505';

/**
 * Services the parish offers on the booking form: not hidden, not deleted, in the parish's own order.
 */
export async function getBookableServiceTypes(churchId: string): Promise<ServiceType[]> {
    const { data, error } = await supabase
        .from('church_service_types')
        .select('*')
        .eq('church_id', churchId)
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

/**
 * Every service the parish office manages: hidden ones included (they can be restored), deleted ones not.
 */
export async function getManageableServiceTypes(churchId: string): Promise<ServiceType[]> {
    const { data, error } = await supabase
        .from('church_service_types')
        .select('*')
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

/**
 * The parish's live service of a starter kind (baptism, wedding, funeral, ...), whatever it is called now.
 */
export async function getServiceTypeByKind(churchId: string, kind: string): Promise<ServiceType | null> {
    const { data, error } = await supabase
        .from('church_service_types')
        .select('*')
        .eq('church_id', churchId)
        .eq('kind', kind)
        .is('deleted_at', null)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Adds a service at the end of the parish's list.
 */
export async function createServiceType(
    churchId: string,
    input: { name: string; description?: string | null }
): Promise<ServiceType> {
    const existing = await getManageableServiceTypes(churchId);
    const nextOrder = existing.reduce((highest, service) => Math.max(highest, service.display_order), 0) + 1;

    const { data, error } = await supabase
        .from('church_service_types')
        .insert({
            church_id: churchId,
            name: input.name,
            description: input.description ?? null,
            display_order: nextOrder,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

/**
 * Renames, describes, reorders, hides or restores a service. A rename follows to every appointment and
 * checklist document of the service in the same transaction (database trigger).
 */
export async function updateServiceType(id: string, updates: ServiceTypeUpdate): Promise<ServiceType> {
    const { data, error } = await supabase
        .from('church_service_types')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

/**
 * Deletes a service. The database soft-deletes it when appointments use it ("archived": it leaves the booking
 * form and the admin list, appointments keep working) and removes it with its checklist when nothing does.
 */
export async function deleteServiceType(id: string): Promise<'deleted' | 'archived'> {
    const { data, error } = await supabase.rpc('delete_church_service_type', { p_service_type_id: id });

    if (error) throw error;
    return data === 'archived' ? 'archived' : 'deleted';
}

/**
 * Gives a new parish the six starter services (Baptism, Wedding, Funeral, Confirmation, Blessing, Other).
 * Safe to call again: a starter the parish already has, renamed or deleted is never added back.
 */
export async function seedDefaultServiceTypes(churchId: string): Promise<ServiceType[]> {
    const { data, error } = await supabase.rpc('seed_church_service_types', { p_church_id: churchId });

    if (error) throw error;
    return data ?? [];
}

/** True when a write failed because another service of the parish already has that name. */
export function isDuplicateServiceNameError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

/**
 * Finds the service in a parish's list that a piece of text (a saved name, or a name passed through
 * navigation state) refers to, ignoring case and surrounding spaces.
 */
export function findServiceByName<T extends Pick<ServiceType, 'name'>>(services: T[], name: string | null | undefined): T | undefined {
    const wanted = (name || '').trim().toLowerCase();
    if (!wanted) return undefined;
    return services.find((service) => service.name.trim().toLowerCase() === wanted);
}

/**
 * Whether a service is a funeral. The starter Funeral keeps its `funeral` kind through a rename, so a renamed
 * Funeral still gets the burial treatment; a service without a kind (custom, or created from old text) is
 * recognised by its name, as before.
 */
export function isFuneralService(kind: string | null | undefined, name: string | null | undefined): boolean {
    if (kind) return kind === 'funeral';
    const text = (name || '').toLowerCase();
    return text.includes('funeral') || text.includes('burial');
}
