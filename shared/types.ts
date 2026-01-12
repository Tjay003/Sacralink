// ============================================
// SACRALINK - Shared TypeScript Types
// Generated from Sacralink_database.sql
// ============================================

// ============================================
// ENUMS
// ============================================

export type UserRole = 'super_admin' | 'admin' | 'priest' | 'volunteer' | 'user';

export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';

export type SacramentType =
    | 'baptism'
    | 'wedding'
    | 'funeral'
    | 'confirmation'
    | 'counseling'
    | 'mass_intention'
    | 'confession'
    | 'anointing';

export type DonationStatus = 'pending' | 'verified' | 'rejected';

// ============================================
// DATABASE TABLES
// ============================================

export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: UserRole;
    church_id: string | null;
    avatar_url: string | null;
    phone_number: string | null;
    is_verified: boolean;
    fcm_token: string | null;
    created_at: string;
    updated_at: string;
}

export interface Church {
    id: string;
    name: string;
    address: string;
    description: string | null;
    contact_number: string | null;
    email: string | null;
    latitude: number | null;
    longitude: number | null;
    livestream_url: string | null;
    donation_qr_url: string | null;
    panorama_url: string | null;
    gcash_number: string | null;
    maya_number: string | null;
    operating_hours: OperatingHours | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface OperatingHours {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
}

export interface MassSchedule {
    id: string;
    church_id: string;
    day_of_week: number; // 0 = Sunday, 6 = Saturday
    start_time: string; // "HH:MM:SS"
    end_time: string;
    mass_type: 'regular' | 'anticipated' | 'special';
    language: string;
    is_active: boolean;
    created_at: string;
}

export interface PriestAvailability {
    id: string;
    priest_id: string;
    church_id: string;
    available_date: string; // "YYYY-MM-DD"
    start_time: string;
    end_time: string;
    is_blocked: boolean;
    notes: string | null;
    created_at: string;
}

export interface ServiceDuration {
    id: string;
    church_id: string;
    service_type: SacramentType;
    duration_minutes: number;
    max_per_day: number;
}

export interface Appointment {
    id: string;
    user_id: string;
    church_id: string;
    priest_id: string | null;
    service_type: SacramentType;
    requested_date: string;
    end_time: string | null;
    status: AppointmentStatus;
    notes: string | null;
    admin_feedback: string | null;
    created_at: string;
    updated_at: string;
}

export interface SacramentRequirement {
    id: string;
    church_id: string;
    service_type: SacramentType;
    requirement_name: string;
    description: string | null;
    is_required: boolean;
    created_at: string;
}

export interface AppointmentDocument {
    id: string;
    appointment_id: string;
    requirement_id: string | null;
    file_url: string;
    file_name: string | null;
    is_verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
    created_at: string;
}

export interface Donation {
    id: string;
    user_id: string;
    church_id: string;
    amount: number;
    reference_number: string | null;
    proof_url: string | null;
    status: DonationStatus;
    verified_by: string | null;
    verified_at: string | null;
    notes: string | null;
    created_at: string;
}

export interface Announcement {
    id: string;
    church_id: string;
    title: string;
    body: string;
    image_url: string | null;
    is_pinned: boolean;
    is_active: boolean;
    expires_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface ActivityLog {
    id: string;
    user_id: string | null;
    church_id: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// ============================================
// JOIN TYPES (With Relations)
// ============================================

export interface AppointmentWithRelations extends Appointment {
    user?: Profile;
    church?: Church;
    priest?: Profile;
    documents?: AppointmentDocument[];
}

export interface DonationWithRelations extends Donation {
    user?: Profile;
    church?: Church;
    verifier?: Profile;
}

export interface AnnouncementWithRelations extends Announcement {
    church?: Church;
    creator?: Profile;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================
// FORM INPUT TYPES
// ============================================

export interface CreateAppointmentInput {
    church_id: string;
    service_type: SacramentType;
    requested_date: string;
    notes?: string;
}

export interface CreateDonationInput {
    church_id: string;
    amount: number;
    reference_number?: string;
    proof_url?: string;
}

export interface UpdateProfileInput {
    full_name?: string;
    phone_number?: string;
    avatar_url?: string;
}

export interface CreateChurchInput {
    name: string;
    address: string;
    description?: string;
    contact_number?: string;
    email?: string;
    latitude?: number;
    longitude?: number;
    gcash_number?: string;
    maya_number?: string;
}

export interface CreateAnnouncementInput {
    church_id: string;
    title: string;
    body: string;
    image_url?: string;
    is_pinned?: boolean;
    expires_at?: string;
}

// ============================================
// AI SCHEDULER TYPES
// ============================================

export interface AvailabilitySlot {
    date: string;
    start_time: string;
    end_time: string;
    priest_id?: string;
    priest_name?: string;
}

export interface AvailabilityCheckRequest {
    church_id: string;
    service_type: SacramentType;
    requested_date: string;
}

export interface AvailabilityCheckResponse {
    is_available: boolean;
    requested_slot?: AvailabilitySlot;
    suggested_slots?: AvailabilitySlot[];
    reason?: string;
}
