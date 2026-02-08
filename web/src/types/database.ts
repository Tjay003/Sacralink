// ============================================
// SACRALINK - Database Types for Supabase
// Auto-generated structure matching schema
// ============================================

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string | null;
                    full_name: string | null;
                    role: 'super_admin' | 'admin' | 'church_admin' | 'priest' | 'volunteer' | 'user';
                    church_id: string | null;
                    assigned_church_id: string | null;
                    avatar_url: string | null;
                    phone_number: string | null;
                    is_verified: boolean;
                    fcm_token: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email?: string | null;
                    full_name?: string | null;
                    role?: 'super_admin' | 'admin' | 'church_admin' | 'priest' | 'volunteer' | 'user';
                    church_id?: string | null;
                    assigned_church_id?: string | null;
                    avatar_url?: string | null;
                    phone_number?: string | null;
                    is_verified?: boolean;
                    fcm_token?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string | null;
                    full_name?: string | null;
                    role?: 'super_admin' | 'admin' | 'church_admin' | 'priest' | 'volunteer' | 'user';
                    church_id?: string | null;
                    assigned_church_id?: string | null;
                    avatar_url?: string | null;
                    phone_number?: string | null;
                    is_verified?: boolean;
                    fcm_token?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            churches: {
                Row: {
                    id: string;
                    name: string;
                    address: string;
                    description: string | null;
                    contact_number: string | null;
                    email: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    facebook_url: string | null;
                    livestream_url: string | null;
                    donation_qr_url: string | null;
                    panorama_url: string | null;
                    gcash_number: string | null;
                    maya_number: string | null;
                    operating_hours: Record<string, { open: string; close: string }> | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    address: string;
                    description?: string | null;
                    contact_number?: string | null;
                    email?: string | null;
                    latitude?: number | null;
                    longitude?: number | null;
                    facebook_url?: string | null;
                    livestream_url?: string | null;
                    donation_qr_url?: string | null;
                    panorama_url?: string | null;
                    gcash_number?: string | null;
                    maya_number?: string | null;
                    operating_hours?: Record<string, { open: string; close: string }> | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    address?: string;
                    description?: string | null;
                    contact_number?: string | null;
                    email?: string | null;
                    latitude?: number | null;
                    longitude?: number | null;
                    facebook_url?: string | null;
                    livestream_url?: string | null;
                    donation_qr_url?: string | null;
                    panorama_url?: string | null;
                    gcash_number?: string | null;
                    maya_number?: string | null;
                    operating_hours?: Record<string, { open: string; close: string }> | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };

            church_images: {
                Row: {
                    id: string;
                    church_id: string;
                    image_url: string;
                    display_order: number;
                    uploaded_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    image_url: string;
                    display_order?: number;
                    uploaded_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    image_url?: string;
                    display_order?: number;
                    uploaded_by?: string | null;
                    created_at?: string;
                };
            };

            donations: {
                Row: {
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
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    church_id: string;
                    amount: number;
                    reference_number?: string | null;
                    proof_url?: string | null;
                    status?: 'pending' | 'verified' | 'rejected';
                    verified_by?: string | null;
                    verified_at?: string | null;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    church_id?: string;
                    amount?: number;
                    reference_number?: string | null;
                    proof_url?: string | null;
                    status?: 'pending' | 'verified' | 'rejected';
                    verified_by?: string | null;
                    verified_at?: string | null;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            announcements: {
                Row: {
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
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    title: string;
                    body: string;
                    image_url?: string | null;
                    is_pinned?: boolean;
                    is_active?: boolean;
                    expires_at?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    title?: string;
                    body?: string;
                    image_url?: string | null;
                    is_pinned?: boolean;
                    is_active?: boolean;
                    expires_at?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };

                notifications: {
                    Row: {
                        id: string;
                        user_id: string;
                        type: string;
                        title: string;
                        message: string;
                        link: string | null;
                        is_read: boolean;
                        created_at: string;
                    };
                    Insert: {
                        id?: string;
                        user_id: string;
                        type: string;
                        title: string;
                        message: string;
                        link?: string | null;
                        is_read?: boolean;
                        created_at?: string;
                    };
                    Update: {
                        id?: string;
                        user_id?: string;
                        type?: string;
                        title?: string;
                        message?: string;
                        link?: string | null;
                        is_read?: boolean;
                        created_at?: string;
                    };
                };
            };
            mass_schedules: {
                Row: {
                    id: string;
                    church_id: string;
                    day_of_week: string;
                    time: string;
                    language: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    day_of_week: string;
                    time: string;
                    language?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    day_of_week?: string;
                    time?: string;
                    language?: string | null;
                    created_at?: string;
                };
            };
            appointments: {
                Row: {
                    id: string;
                    user_id: string;
                    church_id: string;
                    service_type: string;
                    appointment_date: string;
                    appointment_time: string;
                    status: string;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    church_id: string;
                    service_type: string;
                    appointment_date: string;
                    appointment_time: string;
                    status?: string;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    church_id?: string;
                    service_type?: string;
                    appointment_date?: string;
                    appointment_time?: string;
                    status?: string;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            priest_availability: {
                Row: {
                    id: string;
                    priest_id: string;
                    church_id: string;
                    available_date: string;
                    start_time: string;
                    end_time: string;
                    is_blocked: boolean;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    priest_id: string;
                    church_id: string;
                    available_date: string;
                    start_time: string;
                    end_time: string;
                    is_blocked?: boolean;
                    notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    priest_id?: string;
                    church_id?: string;
                    available_date?: string;
                    start_time?: string;
                    end_time?: string;
                    is_blocked?: boolean;
                    notes?: string | null;
                    created_at?: string;
                };
            };
            service_durations: {
                Row: {
                    id: string;
                    church_id: string;
                    service_type: 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
                    duration_minutes: number;
                    max_per_day: number;
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    service_type: 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
                    duration_minutes?: number;
                    max_per_day?: number;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    service_type?: 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
                    duration_minutes?: number;
                    max_per_day?: number;
                };
            };
            sacrament_requirements: {
                Row: {
                    id: string;
                    church_id: string;
                    service_type: string;
                    requirement_name: string;
                    description: string | null;
                    is_required: boolean;
                    allowed_file_types: string[];
                    display_order: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    service_type: string;
                    requirement_name: string;
                    description?: string | null;
                    is_required?: boolean;
                    allowed_file_types?: string[];
                    display_order?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    service_type?: string;
                    requirement_name?: string;
                    description?: string | null;
                    is_required?: boolean;
                    allowed_file_types?: string[];
                    display_order?: number;
                    created_at?: string;
                };
            };
            appointment_documents: {
                Row: {
                    id: string;
                    appointment_id: string;
                    requirement_id: string | null;
                    file_url: string;
                    file_name: string;
                    file_type: string;
                    file_size: number | null;
                    uploaded_at: string;
                    uploaded_by: string | null;
                };
                Insert: {
                    id?: string;
                    appointment_id: string;
                    requirement_id?: string | null;
                    file_url: string;
                    file_name: string;
                    file_type: string;
                    file_size?: number | null;
                    uploaded_at?: string;
                    uploaded_by?: string | null;
                };
                Update: {
                    id?: string;
                    appointment_id?: string;
                    requirement_id?: string | null;
                    file_url?: string;
                    file_name?: string;
                    file_type?: string;
                    file_size?: number | null;
                    uploaded_at?: string;
                    uploaded_by?: string | null;
                };
            };
            activity_logs: {
                Row: {
                    id: string;
                    user_id: string | null;
                    church_id: string | null;
                    action: string;
                    entity_type: string | null;
                    entity_id: string | null;
                    metadata: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    church_id?: string | null;
                    action: string;
                    entity_type?: string | null;
                    entity_id?: string | null;
                    metadata?: Record<string, unknown> | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    church_id?: string | null;
                    action?: string;
                    entity_type?: string | null;
                    entity_id?: string | null;
                    metadata?: Record<string, unknown> | null;
                    created_at?: string;
                }
            };

            church_announcements: {
                Row: {
                    id: string;
                    church_id: string;
                    title: string;
                    content: string;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                    is_pinned: boolean;
                };
                Insert: {
                    id?: string;
                    church_id: string;
                    title: string;
                    content: string;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    is_pinned?: boolean;
                };
                Update: {
                    id?: string;
                    church_id?: string;
                    title?: string;
                    content?: string;
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    is_pinned?: boolean;
                };
            };

            system_announcements: {
                Row: {
                    id: string;
                    title: string;
                    content: string;
                    type: 'info' | 'warning' | 'maintenance' | 'success';
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                    expires_at: string | null;
                    is_active: boolean;
                };
                Insert: {
                    id?: string;
                    title: string;
                    content: string;
                    type?: 'info' | 'warning' | 'maintenance' | 'success';
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    expires_at?: string | null;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    title?: string;
                    content?: string;
                    type?: 'info' | 'warning' | 'maintenance' | 'success';
                    created_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    expires_at?: string | null;
                    is_active?: boolean;
                };
            };
        };
        Enums: {
            user_role: 'super_admin' | 'admin' | 'church_admin' | 'priest' | 'volunteer' | 'user';
            appt_status: 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';
            sacrament_type: 'baptism' | 'wedding' | 'funeral' | 'confirmation' | 'counseling' | 'mass_intention' | 'confession' | 'anointing';
            donation_status: 'pending' | 'verified' | 'rejected';
        };
    };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Shorthand types
export type Profile = Tables<'profiles'>;
export type Church = Tables<'churches'>;
export type Appointment = Tables<'appointments'>;
export type Donation = Tables<'donations'>;
export type Announcement = Tables<'announcements'>;
export type MassSchedule = Tables<'mass_schedules'>;
export type PriestAvailability = Tables<'priest_availability'>;
export type ServiceDuration = Tables<'service_durations'>;
export type SacramentRequirement = Tables<'sacrament_requirements'>;
export type AppointmentDocument = Tables<'appointment_documents'>;
export type ActivityLog = Tables<'activity_logs'>;
export type ChurchAnnouncement = Tables<'church_announcements'>;
export type SystemAnnouncement = Tables<'system_announcements'>;
