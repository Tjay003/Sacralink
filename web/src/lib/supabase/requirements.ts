import { supabase } from '../supabase';
import type { Database } from '@/types/database';
import { seedDefaultServiceTypes } from './serviceTypes';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];
type InsertSacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Insert'];
type UpdateSacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Update'];

/**
 * Fetch the checklist of one service of a parish by the service's id (a rename never loses it)
 */
export async function getRequirementsForService(serviceTypeId: string) {
    const { data, error } = await supabase
        .from('sacrament_requirements')
        .select('*')
        .eq('service_type_id', serviceTypeId)
        .order('display_order', { ascending: true });

    if (error) throw error;
    return data as SacramentRequirement[];
}

/**
 * Create a new requirement
 */
export async function createRequirement(requirement: InsertSacramentRequirement) {
    const { data, error } = await supabase
        .from('sacrament_requirements')
        .insert(requirement)
        .select()
        .single();

    if (error) throw error;
    return data as SacramentRequirement;
}

/**
 * Update an existing requirement
 */
export async function updateRequirement(id: string, updates: UpdateSacramentRequirement) {
    const { data, error } = await supabase
        .from('sacrament_requirements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

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
 * The starter checklists, keyed by the kind of the starter service they belong to
 */
const DEFAULT_CHECKLISTS: Record<string, Array<{ name: string; required: boolean }>> = {
    baptism: [
        { name: 'Birth Certificate', required: true },
        { name: 'Godparent Certificate', required: true },
        { name: 'Parent Marriage Certificate', required: false },
    ],
    wedding: [
        { name: 'Baptismal Certificate (Bride)', required: true },
        { name: 'Baptismal Certificate (Groom)', required: true },
        { name: 'Confirmation Certificate', required: true },
        { name: 'CENOMAR (Certificate of No Marriage)', required: true },
        { name: 'Pre-Cana Certificate', required: true },
    ],
    confirmation: [
        { name: 'Baptismal Certificate', required: true },
        { name: 'First Communion Certificate', required: true },
        { name: 'Sponsor Certificate', required: true },
    ],
};

/**
 * Bulk seed the starter services and their default checklists for a new church
 * Called when a new church is created. A service that already has documents is left alone.
 */
export async function seedDefaultRequirements(churchId: string) {
    const services = await seedDefaultServiceTypes(churchId);

    const { data: existing, error: existingError } = await supabase
        .from('sacrament_requirements')
        .select('service_type_id')
        .eq('church_id', churchId);
    if (existingError) throw existingError;
    const alreadyHasChecklist = new Set((existing ?? []).map((row) => row.service_type_id));

    const defaultRequirements: InsertSacramentRequirement[] = [];
    for (const service of services) {
        const checklist = service.kind ? DEFAULT_CHECKLISTS[service.kind] : undefined;
        if (!checklist || alreadyHasChecklist.has(service.id)) continue;
        checklist.forEach((item, index) => {
            defaultRequirements.push({
                church_id: churchId,
                service_type_id: service.id,
                service_type: service.name.toLowerCase(),
                requirement_name: item.name,
                is_required: item.required,
                display_order: index + 1,
            });
        });
    }

    if (defaultRequirements.length === 0) return [] as SacramentRequirement[];

    const { data, error } = await supabase
        .from('sacrament_requirements')
        .insert(defaultRequirements)
        .select();

    if (error) throw error;
    return data as SacramentRequirement[];
}
