import { supabase } from '../supabase';
import type { Database } from '@/types/database';

type AppointmentDocument = Database['public']['Tables']['appointment_documents']['Row'];
type InsertAppointmentDocument = Database['public']['Tables']['appointment_documents']['Insert'];

/**
 * Upload a document for an appointment
 * @param appointmentId - The appointment ID
 * @param requirementId - The requirement this document fulfills
 * @param file - The file to upload
 * @returns The created document record
 */
export async function uploadDocument(
    appointmentId: string,
    requirementId: string,
    file: File
): Promise<AppointmentDocument> {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Generate unique file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${appointmentId}/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
            .from('appointment-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('appointment-documents')
            .getPublicUrl(filePath);

        // Create document record
        const documentData: InsertAppointmentDocument = {
            appointment_id: appointmentId,
            requirement_id: requirementId,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id
        };

        // @ts-ignore - Supabase type inference issue
        const { data, error } = await (supabase
            .from('appointment_documents')
            .insert(documentData as any)
            .select()
            .single() as any);

        if (error) throw error;
        return data as AppointmentDocument;

    } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
}

/**
 * Get all documents for an appointment
 */
export async function getAppointmentDocuments(appointmentId: string) {
    const { data, error } = await supabase
        .from('appointment_documents')
        .select('*, sacrament_requirements(*)')
        .eq('appointment_id', appointmentId)
        .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string) {
    // First get the document to find the file path
    const { data: document, error: fetchError } = await (supabase
        .from('appointment_documents')
        .select('file_url')
        .eq('id', documentId)
        .single() as any);

    if (fetchError) throw fetchError;

    // Extract file path from URL and delete from storage
    if (document?.file_url) {
        const pathMatch = document.file_url.match(/appointment-documents\/(.+)$/);
        if (pathMatch) {
            const filePath = pathMatch[1];
            const { error: storageError } = await supabase.storage
                .from('appointment-documents')
                .remove([filePath]);

            if (storageError) console.error('Error deleting file from storage:', storageError);
        }
    }

    // Delete database record
    const { error } = await supabase
        .from('appointment_documents')
        .delete()
        .eq('id', documentId);

    if (error) throw error;
}

/**
 * Download a document
 * @param fileUrl - The public URL of the file
 */
export async function downloadDocument(fileUrl: string, fileName: string) {
    try {
        // Fetch the file as a blob
        const response = await fetch(fileUrl);
        const blob = await response.blob();

        // Create a temporary URL for the blob
        const blobUrl = window.URL.createObjectURL(blob);

        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        // Clean up
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file:', error);
        // Fallback to opening in new tab if download fails
        window.open(fileUrl, '_blank');
    }
}
