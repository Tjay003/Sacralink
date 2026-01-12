// ============================================
// SACRALINK - Shared Constants
// ============================================

// ============================================
// SACRAMENT LABELS & CONFIG
// ============================================

export const SACRAMENT_LABELS: Record<string, string> = {
    baptism: 'Baptism',
    wedding: 'Wedding',
    funeral: 'Funeral Mass',
    confirmation: 'Confirmation',
    counseling: 'Counseling',
    mass_intention: 'Mass Intention',
    confession: 'Confession',
    anointing: 'Anointing of the Sick',
};

export const SACRAMENT_ICONS: Record<string, string> = {
    baptism: 'droplets',
    wedding: 'heart',
    funeral: 'cross',
    confirmation: 'flame',
    counseling: 'message-circle',
    mass_intention: 'book-open',
    confession: 'hand-helping',
    anointing: 'hand-heart',
};

export const DEFAULT_DURATIONS: Record<string, number> = {
    baptism: 60,
    wedding: 120,
    funeral: 90,
    confirmation: 45,
    counseling: 30,
    mass_intention: 15,
    confession: 15,
    anointing: 30,
};

// ============================================
// STATUS LABELS & COLORS
// ============================================

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    rescheduled: 'Rescheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B',    // Amber
    approved: '#10B981',   // Green
    rejected: '#EF4444',   // Red
    rescheduled: '#3B82F6', // Blue
    completed: '#6B7280',   // Gray
    cancelled: '#9CA3AF',   // Light Gray
};

export const DONATION_STATUS_LABELS: Record<string, string> = {
    pending: 'Pending Verification',
    verified: 'Verified',
    rejected: 'Rejected',
};

export const DONATION_STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B',
    verified: '#10B981',
    rejected: '#EF4444',
};

// ============================================
// ROLE LABELS & PERMISSIONS
// ============================================

export const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Parish Admin',
    priest: 'Priest',
    volunteer: 'Volunteer',
    user: 'Parishioner',
};

export const ROLE_HIERARCHY: Record<string, number> = {
    super_admin: 100,
    admin: 80,
    priest: 60,
    volunteer: 40,
    user: 20,
};

// ============================================
// DAYS OF WEEK
// ============================================

export const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
];

// ============================================
// STORAGE BUCKETS
// ============================================

export const STORAGE_BUCKETS = {
    AVATARS: 'avatars',
    PANORAMAS: 'panoramas',
    DONATION_QR: 'donation-qr',
    DONATION_PROOFS: 'donation-proofs',
    ANNOUNCEMENTS: 'announcements',
    DOCUMENTS: 'documents',
} as const;

// ============================================
// APP CONFIG
// ============================================

export const APP_CONFIG = {
    name: 'SacraLink',
    tagline: 'Connecting Faith, Simplified',
    version: '1.0.0',
    supportEmail: 'support@sacralink.ph',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedDocTypes: ['application/pdf', 'image/jpeg', 'image/png'],
};

// ============================================
// DESIGN TOKENS
// ============================================

export const COLORS = {
    primary: '#2563EB',      // Faith Blue
    secondary: '#64748B',    // Stone Gray
    accent: '#F59E0B',       // Sacred Gold
    success: '#10B981',      // Green
    destructive: '#EF4444',  // Red
    warning: '#F59E0B',      // Amber
    info: '#3B82F6',         // Blue
    background: '#F8FAFC',   // Slate-50
    foreground: '#0F172A',   // Slate-900
    muted: '#94A3B8',        // Slate-400
    border: '#E2E8F0',       // Slate-200
};

// ============================================
// VALIDATION
// ============================================

export const VALIDATION = {
    phoneRegex: /^(\+63|0)?9\d{9}$/,
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    minPasswordLength: 8,
    maxNameLength: 100,
    maxDescriptionLength: 1000,
    maxNotesLength: 500,
};

// ============================================
// PAGINATION
// ============================================

export const PAGINATION = {
    defaultPageSize: 20,
    maxPageSize: 100,
};
