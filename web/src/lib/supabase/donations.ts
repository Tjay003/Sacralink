import { supabase } from '../supabase';
import { notifyDonorOfDonationStatus } from './notifications';

export interface Donation {
    id: string;
    user_id: string;
    church_id: string;
    amount: number;
    reference_number: string | null;
    proof_url: string | null;
    status: 'pending' | 'verified' | 'rejected';
    verified_by: string | null;
    verified_at: string | null;
    notes: string | null;
    created_at: string | null;
    // Joined fields
    church?: { name: string };
    donor?: { full_name: string | null; email: string | null };
    verifier?: { full_name: string | null };
}

/**
 * Submit a new donation with proof upload
 */
export async function submitDonation({
    churchId,
    amount,
    referenceNumber,
    proofFile,
}: {
    churchId: string;
    amount: number;
    referenceNumber: string;
    proofFile: File;
}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Upload proof image to storage
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('donation-proofs')
            .upload(fileName, proofFile, { upsert: false });

        if (uploadError) throw uploadError;

        // Get public URL (signed URL for private bucket)
        const { data: urlData } = await supabase.storage
            .from('donation-proofs')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

        const proofUrl = urlData?.signedUrl || null;

        // Insert donation record
        const { data, error } = await supabase
            .from('donations')
            .insert({
                user_id: user.id,
                church_id: churchId,
                amount,
                reference_number: referenceNumber,
                proof_url: proofUrl,
                status: 'pending',
            })
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (err: any) {
        console.error('Error submitting donation:', err);
        return { data: null, error: err };
    }
}

/**
 * Get current user's donation history with totals
 */
export async function getUserDonations() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('donations')
            .select(`
                *,
                church:churches(name)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const totalDonated = (data || [])
            .filter(d => d.status === 'verified')
            .reduce((sum, d) => sum + Number(d.amount), 0);

        return { data: data as Donation[], totalDonated, error: null };
    } catch (err: any) {
        console.error('Error fetching user donations:', err);
        return { data: [], totalDonated: 0, error: err };
    }
}

/**
 * Get donations for a church (admin view)
 */
export async function getChurchDonations(churchId: string, status?: 'pending' | 'verified' | 'rejected') {
    try {
        let query = supabase
            .from('donations')
            .select(`
                *,
                church:churches(name),
                donor:profiles!donations_user_id_fkey(full_name, email),
                verifier:profiles!donations_verified_by_fkey(full_name)
            `)
            .eq('church_id', churchId)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data: data as Donation[], error: null };
    } catch (err: any) {
        console.error('Error fetching church donations:', err);
        return { data: [], error: err };
    }
}

/**
 * Get all donations (super admin / admin view)
 */
export async function getAllDonations(status?: 'pending' | 'verified' | 'rejected') {
    try {
        let query = supabase
            .from('donations')
            .select(`
                *,
                church:churches(name),
                donor:profiles!donations_user_id_fkey(full_name, email),
                verifier:profiles!donations_verified_by_fkey(full_name)
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { data: data as Donation[], error: null };
    } catch (err: any) {
        console.error('Error fetching all donations:', err);
        return { data: [], error: err };
    }
}

/**
 * Verify a donation
 */
export async function verifyDonation(donationId: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('donations')
            .update({
                status: 'verified',
                verified_by: user.id,
                verified_at: new Date().toISOString(),
                notes: null,
            })
            .eq('id', donationId)
            .select('*, church:churches(name)')
            .single();

        if (error) throw error;

        // Notify the donor
        const churchName = (data.church as any)?.name || 'the church';
        await notifyDonorOfDonationStatus(data.user_id, churchName, data.amount, 'verified');

        return { data, error: null };
    } catch (err: any) {
        console.error('Error verifying donation:', err);
        return { data: null, error: err };
    }
}

/**
 * Reject a donation with notes
 */
export async function rejectDonation(donationId: string, notes: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('donations')
            .update({
                status: 'rejected',
                verified_by: user.id,
                verified_at: new Date().toISOString(),
                notes,
            })
            .eq('id', donationId)
            .select('*, church:churches(name)')
            .single();

        if (error) throw error;

        // Notify the donor
        const churchName = (data.church as any)?.name || 'the church';
        await notifyDonorOfDonationStatus(data.user_id, churchName, data.amount, 'rejected', notes);

        return { data, error: null };
    } catch (err: any) {
        console.error('Error rejecting donation:', err);
        return { data: null, error: err };
    }
}

/**
 * Get recent verified donors for public recognition (masked)
 * Returns: { maskedName: "M. Santos", timeAgo: "2 days ago" }
 */
export async function getRecentDonors(churchId: string, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('donations')
            .select(`
                id,
                created_at,
                donor:profiles!donations_user_id_fkey(full_name)
            `)
            .eq('church_id', churchId)
            .eq('status', 'verified')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const masked = (data || []).map((d: any) => {
            const name: string = d.donor?.full_name || 'Anonymous';
            const parts = name.trim().split(' ');
            const maskedName = parts.length >= 2
                ? `${parts[0][0]}. ${parts[parts.length - 1]}`
                : name;
            return {
                id: d.id,
                maskedName,
                created_at: d.created_at,
            };
        });

        return { data: masked, error: null };
    } catch (err: any) {
        console.error('Error fetching recent donors:', err);
        return { data: [], error: err };
    }
}

/**
 * Get signed URL for a proof image (for admins)
 */
export async function getDonationProofUrl(proofPath: string): Promise<string | null> {
    try {
        const { data } = await supabase.storage
            .from('donation-proofs')
            .createSignedUrl(proofPath, 3600);
        return data?.signedUrl || null;
    } catch {
        return null;
    }
}
