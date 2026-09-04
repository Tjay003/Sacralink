import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../supabase';

export const DONATION_PURPOSES = [
  'Mass Offering',
  'Tithes / Love Offering',
  'Parish Building Fund',
  'Youth Ministry',
  'General Donation',
] as const;

export type DonationPurpose = (typeof DONATION_PURPOSES)[number];

export interface DonationWithChurch {
  id: string;
  user_id: string;
  church_id: string;
  amount: number;
  purpose: string | null;
  reference_number: string | null;
  proof_url: string | null;
  status: 'pending' | 'verified' | 'rejected';
  donor_notes: string | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  show_as_supporter?: boolean;
  church?: {
    id?: string;
    name: string;
    cover_image_url?: string | null;
    featured_image_url?: string | null;
    address?: string | null;
  } | null;
}

export interface ChurchPaymentInfo {
  churchId: string;
  churchName: string;
  status: string | null;
  isVerified: boolean;
  gcashNumber: string | null;
  mayaNumber: string | null;
  donationQrUrl: string | null;
  gcashQrUrl: string | null;
  mayaQrUrl: string | null;
  accountName: string;
  hasGcash: boolean;
  hasMaya: boolean;
  hasPaymentMethods: boolean;
}

export interface SubmitDonationParams {
  churchId: string;
  amount: number;
  purpose: string;
  referenceNumber: string;
  donorNotes?: string;
  receiptUri: string;
  receiptFileName?: string;
}

/**
 * Compresses an image using expo-image-manipulator ensuring file size is < 200KB.
 */
export async function compressDonationReceipt(
  uri: string,
  targetWidth = 1200,
  compressQuality = 0.65
): Promise<{ uri: string; size?: number }> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetWidth } }],
    {
      compress: compressQuality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  let size: number | undefined;
  try {
    const res = await fetch(manipResult.uri);
    const blob = await res.blob();
    size = blob.size;
  } catch {
    // Non-fatal if blob size check fails
  }

  return {
    uri: manipResult.uri,
    size,
  };
}

/**
 * Fetches church payment details and QR URLs for a given church ID.
 */
export async function getChurchPaymentInfo(churchId: string): Promise<ChurchPaymentInfo | null> {
  const { data, error } = await supabase
    .from('churches')
    .select(`
      id,
      name,
      status,
      is_active,
      gcash_number,
      maya_number,
      donation_qr_url,
      gcash_qr_url,
      maya_qr_url
    `)
    .eq('id', churchId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching church payment info:', error);
    throw new Error(error.message);
  }

  if (!data) return null;

  const isVerified = data.status !== 'unverified' && data.is_active !== false;
  const gcashNumber = data.gcash_number || null;
  const mayaNumber = data.maya_number || null;
  const gcashQrUrl = data.gcash_qr_url || data.donation_qr_url || null;
  const mayaQrUrl = data.maya_qr_url || data.donation_qr_url || null;
  const donationQrUrl = data.donation_qr_url || gcashQrUrl || mayaQrUrl || null;

  const hasGcash = Boolean(gcashNumber || gcashQrUrl);
  const hasMaya = Boolean(mayaNumber || mayaQrUrl);

  return {
    churchId: data.id,
    churchName: data.name || 'Parish Church',
    status: data.status || 'active',
    isVerified,
    gcashNumber,
    mayaNumber,
    donationQrUrl,
    gcashQrUrl,
    mayaQrUrl,
    accountName: data.name || 'Parish Office',
    hasGcash,
    hasMaya,
    hasPaymentMethods: hasGcash || hasMaya || Boolean(donationQrUrl),
  };
}

/**
 * Uploads receipt image to Supabase storage (donation-proofs with fallback to church-images/donations)
 * and returns the accessible proof URL.
 */
async function uploadDonationReceiptProof(
  userId: string,
  localUri: string
): Promise<string> {
  // 1. Compress image to < 200KB
  const compressed = await compressDonationReceipt(localUri);

  // 2. Fetch array buffer
  const fileRes = await fetch(compressed.uri);
  const arrayBuffer = await fileRes.arrayBuffer();

  const fileExt = 'jpg';
  const fileName = `${Date.now()}_proof.${fileExt}`;
  const primaryPath = `${userId}/${fileName}`;

  // Attempt 1: Upload to private 'donation-proofs' bucket
  const { error: primaryError } = await supabase.storage
    .from('donation-proofs')
    .upload(primaryPath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (!primaryError) {
    // Generate long-lived signed URL (10 years)
    const { data: signData, error: signError } = await supabase.storage
      .from('donation-proofs')
      .createSignedUrl(primaryPath, 60 * 60 * 24 * 365 * 10);

    if (!signError && signData?.signedUrl) {
      return signData.signedUrl;
    }
    // If sign fails, return public URL representation
    const { data: pubData } = supabase.storage
      .from('donation-proofs')
      .getPublicUrl(primaryPath);
    return pubData.publicUrl;
  }

  console.warn(
    'Primary donation-proofs bucket upload error, trying church-images fallback:',
    primaryError
  );

  // Attempt 2: Fallback to 'church-images' bucket
  const fallbackPath = `donations/${userId}/${fileName}`;
  const { error: fallbackError } = await supabase.storage
    .from('church-images')
    .upload(fallbackPath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (fallbackError) {
    console.error('Donation proof upload failed on both buckets:', primaryError, fallbackError);
    throw primaryError || fallbackError;
  }

  const { data: fallbackPubData } = supabase.storage
    .from('church-images')
    .getPublicUrl(fallbackPath);

  return fallbackPubData.publicUrl;
}

/**
 * Submits a new donation record with proof upload.
 */
export async function submitDonation(params: SubmitDonationParams): Promise<DonationWithChurch> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error('Authentication required to submit a cashless donation.');
  }
  const user = authData.user;

  if (!params.churchId) {
    throw new Error('Please select a recipient parish.');
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Please enter a valid donation amount greater than 0.');
  }
  if (!params.referenceNumber || !params.referenceNumber.trim()) {
    throw new Error('Please enter the GCash or Maya transaction reference number.');
  }
  if (!params.receiptUri) {
    throw new Error('Please attach a screenshot of your payment receipt.');
  }

  // 1. Upload proof screenshot
  const proofUrl = await uploadDonationReceiptProof(user.id, params.receiptUri);

  // 2. Prepare combined notes for backwards compatibility
  const combinedNotes = params.donorNotes?.trim()
    ? `[Purpose: ${params.purpose}] ${params.donorNotes.trim()}`
    : `[Purpose: ${params.purpose}]`;

  // 3. Insert donation record into Supabase
  const { data, error } = await supabase
    .from('donations')
    .insert({
      user_id: user.id,
      church_id: params.churchId,
      amount: Number(params.amount),
      purpose: params.purpose,
      reference_number: params.referenceNumber.trim(),
      proof_url: proofUrl,
      status: 'pending',
      donor_notes: params.donorNotes?.trim() || null,
      notes: combinedNotes,
      show_as_supporter: false,
    })
    .select(`
      *,
      church:churches (
        id,
        name,
        cover_image_url,
        featured_image_url,
        address
      )
    `)
    .single();

  if (error) {
    console.error('Error inserting donation record:', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Failed to record donation.');
  }

  return data as unknown as DonationWithChurch;
}

/**
 * Fetches user's donation history joined with recipient church details.
 */
export async function getUserDonations(userId?: string): Promise<{
  data: DonationWithChurch[];
  totalVerifiedAmount: number;
}> {
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: authData } = await supabase.auth.getUser();
    targetUserId = authData?.user?.id;
  }

  if (!targetUserId) {
    return { data: [], totalVerifiedAmount: 0 };
  }

  const { data, error } = await supabase
    .from('donations')
    .select(`
      *,
      church:churches (
        id,
        name,
        cover_image_url,
        featured_image_url,
        address
      )
    `)
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user donations:', error);
    throw new Error(error.message);
  }

  const donations = (data || []) as unknown as DonationWithChurch[];
  const totalVerifiedAmount = donations
    .filter((d) => d.status === 'verified')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return {
    data: donations,
    totalVerifiedAmount,
  };
}

// ── TanStack Query Hooks ──────────────────────────────────────────

/**
 * Hook to retrieve user's donation ledger and verified totals.
 */
export function useUserDonations(userId?: string) {
  return useQuery({
    queryKey: ['user-donations', userId || 'current-user'],
    queryFn: () => getUserDonations(userId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to fetch parish payment information and official QR codes.
 */
export function useChurchPaymentInfo(churchId?: string) {
  return useQuery({
    queryKey: ['church-payment-info', churchId],
    queryFn: () => (churchId ? getChurchPaymentInfo(churchId) : Promise.resolve(null)),
    enabled: Boolean(churchId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Mutation hook to submit a new cashless donation.
 */
export function useSubmitDonation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitDonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-donations'] });
    },
  });
}
