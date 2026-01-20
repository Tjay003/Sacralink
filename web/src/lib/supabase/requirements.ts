import { supabase } from '../supabase';
import type { Database } from '@/types/database';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];
type InsertSacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Insert'];
type UpdateSacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Update'];

/**
 * Fetch all requirements for a specific church and service type
 */
export async function getRequirements(churchId: string, serviceType: string) {
    const { data, error } = await supabase
        .from('sacrament_requirements')
        .select('*')
        .eq('church_id', churchId)
        .eq('service_type', serviceType)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return data as SacramentRequirement[];
}

/**
 * Create a new requirement
 */
export async function createRequirement(requirement: InsertSacramentRequirement) {
    // @ts-ignore - Supabase type inference issue
    const { data, error } = await (supabase
        .from('sacrament_requirements')
        .insert(requirement as any)
        .select()
        .single() as any);

    if (error) throw error;
    return data as SacramentRequirement;
}

/**
 * Update an existing requirement
 */
export async function updateRequirement(id: string, updates: UpdateSacramentRequirement) {
    const { data, error } = await (supabase
        .from('sacrament_requirements')
        // @ts-ignore - Supabase type inference issue
        .update(updates as any)
        .eq('id', id)
        .select()
        .single() as any);

    if (error) throw error;
    return data as SacramentRequirement;
}

/**
 * Delete a requirement
 */
export async function deleteRequirement(id: string) {
    const { error } = await supabase
        .from('sacrament_requirements')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

/**
 * Bulk seed default requirements for a new church
 * Called when a new church is created
 */
export async function seedDefaultRequirements(churchId: string) {
    const defaultRequirements: InsertSacramentRequirement[] = [
        // Baptism
        { church_id: churchId, service_type: 'Baptism', requirement_name: 'Birth Certificate', is_required: true, display_order: 1 },
        { church_id: churchId, service_type: 'Baptism', requirement_name: 'Godparent Certificate', is_required: true, display_order: 2 },
        { church_id: churchId, service_type: 'Baptism', requirement_name: 'Parent Marriage Certificate', is_required: false, display_order: 3 },

        // Wedding
        { church_id: churchId, service_type: 'Wedding', requirement_name: 'Baptismal Certificate (Bride)', is_required: true, display_order: 1 },
        { church_id: churchId, service_type: 'Wedding', requirement_name: 'Baptismal Certificate (Groom)', is_required: true, display_order: 2 },
        { church_id: churchId, service_type: 'Wedding', requirement_name: 'Confirmation Certificate', is_required: true, display_order: 3 },
        { church_id: churchId, service_type: 'Wedding', requirement_name: 'CENOMAR (Certificate of No Marriage)', is_required: true, display_order: 4 },
        { church_id: churchId, service_type: 'Wedding', requirement_name: 'Pre-Cana Certificate', is_required: true, display_order: 5 },

        // Confirmation
        { church_id: churchId, service_type: 'Confirmation', requirement_name: 'Baptismal Certificate', is_required: true, display_order: 1 },
        { church_id: churchId, service_type: 'Confirmation', requirement_name: 'First Communion Certificate', is_required: true, display_order: 2 },
        { church_id: churchId, service_type: 'Confirmation', requirement_name: 'Sponsor Certificate', is_required: true, display_order: 3 },

        // First Communion
        { church_id: churchId, service_type: 'First Communion', requirement_name: 'Baptismal Certificate', is_required: true, display_order: 1 },
        { church_id: churchId, service_type: 'First Communion', requirement_name: 'Attendance Record', is_required: true, display_order: 2 },
    ];

    // @ts-ignore - Supabase type inference issue
    const { data, error } = await (supabase
        .from('sacrament_requirements')
        .insert(defaultRequirements as any)
        .select() as any);

    if (error) throw error;
    return data as SacramentRequirement[];
}
