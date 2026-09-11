import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../hooks/useChurches';
import { Building2, ArrowLeft, ImageIcon, X, Heart, QrCode, Star, ShieldCheck, ShieldAlert, EyeOff } from 'lucide-react';
import GalleryUploader from '../../components/churches/GalleryUploader';
import ChurchLocationPicker from '../../components/churches/ChurchLocationPicker';
import { useAuth } from '../../contexts/AuthContext';
import type { Tables } from '../../types/database';

type ChurchStatus = 'verified_active' | 'unverified' | 'inactive' | 'active';

/**
 * EditChurchPage - Form to edit an existing church
 * 
 * Features:
 * - Pre-fill form with current church data including map coordinates
 * - Same validation as add form
 * - Update database on save
 * - Navigate back to detail page after save
 */
export default function EditChurchPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { church, loading: loadingChurch } = useChurch(id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_number: '',
        email: '',
        description: '',
        status: 'active' as ChurchStatus,
        latitude: null as number | null,
        longitude: null as number | null,
        panorama_url: '',
        livestream_url: '',
        livestream_title: '',
        livestream_platform: 'youtube',
        is_live: false,
        facebook_url: '',
        gcash_number: '',
        maya_number: '',
        gcash_qr_url: '',
        maya_qr_url: '',
        featured_image_url: '',
    });

    const [uploadingQr, setUploadingQr] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [galleryImages, setGalleryImages] = useState<Tables<'church_images'>[]>([]);

    // Fetch gallery images
    const fetchGallery = useCallback(async () => {
        if (!id) return;
        try {
            const { data, error: galleryError } = await supabase
                .from('church_images')
                .select('*')
                .eq('church_id', id)
                .order('display_order', { ascending: true });

            if (galleryError) throw galleryError;
            setGalleryImages(data || []);
        } catch (err) {
            console.error('Error fetching gallery:', err);
        }
    }, [id]);

    // Pre-fill form when church data loads
    useEffect(() => {
        if (church) {
            setFormData({
                name: church.name || '',
                address: church.address || '',
                contact_number: church.contact_number || '',
                email: church.email || '',
                description: church.description || '',
                status: ((church.status as ChurchStatus) || 'active'),
                latitude: church.latitude ?? null,
                longitude: church.longitude ?? null,
                panorama_url: church.panorama_url || '',
                livestream_url: church.livestream_url || '',
                livestream_title: church.livestream_title || '',
                livestream_platform: church.livestream_platform || 'youtube',
                is_live: Boolean(church.is_live),
                facebook_url: church.facebook_url || '',
                gcash_number: church.gcash_number || '',
                maya_number: church.maya_number || '',
                gcash_qr_url: church.gcash_qr_url || '',
                maya_qr_url: church.maya_qr_url || '',
                featured_image_url: church.featured_image_url || '',
            });
        }
    }, [church]);

    useEffect(() => {
        void fetchGallery();
    }, [fetchGallery]);

    // Redirect if not authorized
    // Super Admin: All access
    // Admin: Access if church_id matches
    // Church Admin / Volunteer: Access if assigned_church_id matches
    const canAccess = () => {
        if (!profile) return false;
        if (profile.role === 'super_admin') return true;

        // For admin, church_admin, volunteer -> check if they are editing THEIR church
        if (id) {
            if (profile.role === 'admin' && profile.assigned_church_id === id) return true;
            if ((profile.role === 'church_admin' || profile.role === 'volunteer') && profile.assigned_church_id === id) return true;
        }

        return false;
    };

    if (profile && !canAccess()) {
        return <Navigate to="/churches" replace />;
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `panoramas/${fileName}`;
        setUploading(true);
        setError('');
        try {
            const { error: uploadError } = await supabase.storage
                .from('church-images')
                .upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('church-images').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, panorama_url: data.publicUrl }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to upload image';
            setError('Failed to upload image: ' + message);
        } finally {
            setUploading(false);
        }
    };

    const handleQrUpload = async (field: 'gcash_qr_url' | 'maya_qr_url', e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `qr/${id}-${field}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        setUploadingQr(true);
        setError('');
        try {
            const { error: uploadError } = await supabase.storage
                .from('church-images')
                .upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('church-images').getPublicUrl(fileName);
            setFormData(prev => ({ ...prev, [field]: data.publicUrl }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to upload QR image';
            setError('Failed to upload QR image: ' + message);
        } finally {
            setUploadingQr(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log('📝 Updating church...');

        // Validation
        if (!formData.name.trim()) {
            setError('Church name is required');
            return;
        }

        if (!formData.address.trim()) {
            setError('Address is required');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        // Validate PH contact number if provided
        const contact = formData.contact_number.trim();
        if (contact && !/^(\+639|09)\d{9}$/.test(contact.replace(/\s/g, ''))) {
            setError('Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).');
            setLoading(false);
            return;
        }

        if (!id) return;

        try {
            // Update in database
            const { error: updateError } = await supabase
                .from('churches')
                .update({
                    name: formData.name.trim(),
                    address: formData.address.trim(),
                    contact_number: formData.contact_number.trim() || null,
                    email: formData.email.trim() || null,
                    description: formData.description.trim() || null,
                    status: formData.status,
                    latitude: formData.latitude,
                    longitude: formData.longitude,
                    panorama_url: formData.panorama_url.trim() || null,
                    livestream_url: formData.livestream_url.trim() || null,
                    livestream_title: formData.livestream_title.trim() || null,
                    livestream_platform: formData.livestream_platform,
                    is_live: formData.is_live,
                    facebook_url: formData.facebook_url.trim() || null,
                    gcash_number: formData.gcash_number.trim() || null,
                    maya_number: formData.maya_number.trim() || null,
                    gcash_qr_url: formData.gcash_qr_url.trim() || null,
                    maya_qr_url: formData.maya_qr_url.trim() || null,
                    featured_image_url: formData.featured_image_url?.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (updateError) {
                console.error('❌ Error updating church:', updateError);
                setError(updateError.message);
                setLoading(false);
                return;
            }

            console.log('✅ Church updated successfully');
            setSuccess('Church updated successfully!');

            // Navigate back to detail page after 1 second
            setTimeout(() => {
                navigate(`/churches/${id}`);
            }, 1000);

        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to update church');
            setLoading(false);
        }
    };

    // Loading state
    if (loadingChurch) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading church...</p>
                </div>
            </div>
        );
    }

    // Church not found
    if (!church) {
        return (
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/churches')}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Churches
                </button>
                <div className="card p-6">
                    <div className="text-center text-red-600">
                        <p className="font-semibold mb-2">Church not found</p>
                        <p className="text-sm">This church does not exist</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate(`/churches/${id}`)}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Church Details
                </button>
                <h1 className="text-2xl font-bold">Edit Church</h1>
                <p className="text-muted">Update church information</p>
            </div>

            {/* Form Card */}
            <div className="card p-6">
                {/* Success Message */}
                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-600">{success}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Church Icon */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold">{church.name}</p>
                            <p className="text-sm text-muted">Update church information</p>
                        </div>
                    </div>

                    {/* Church Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Church Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., St. Peter Parish"
                            required
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="Full address of the church"
                            rows={3}
                            required
                        />
                    </div>

                    {/* Interactive Parish Map & Coordinate Storage */}
                    <div className="p-4 bg-secondary-50/50 rounded-2xl border border-border/80">
                        <ChurchLocationPicker
                            latitude={formData.latitude}
                            longitude={formData.longitude}
                            initialAddress={formData.address}
                            disabled={loading}
                            onChange={({ latitude, longitude, address }) => {
                                setFormData(prev => ({
                                    ...prev,
                                    latitude,
                                    longitude,
                                    address: !prev.address.trim() && address ? address : prev.address
                                }));
                            }}
                            onAddressSelect={(address) => {
                                setFormData(prev => ({
                                    ...prev,
                                    address
                                }));
                            }}
                        />
                    </div>

                    {/* Contact Number */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Contact Number
                        </label>
                        <input
                            type="tel"
                            value={formData.contact_number}
                            onChange={(e) => {
                                let raw = e.target.value.replace(/[^0-9+]/g, '');
                                if (raw.startsWith('09')) raw = '+63' + raw.slice(1);
                                if (raw.length > 13) raw = raw.slice(0, 13);
                                setFormData({ ...formData, contact_number: raw });
                            }}
                            disabled={loading}
                            className="input w-full"
                            placeholder="09171234567 or +639171234567"
                            maxLength={13}
                            inputMode="tel"
                        />
                        <p className="text-xs text-muted mt-1">Philippine mobile number — 11 digits starting with 09, or +639XXXXXXXXXX</p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., info@stpeter.church"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="Brief description of the church"
                            rows={4}
                        />
                    </div>

                    {/* Parish Verification & Security Status */}
                    {profile?.role === 'super_admin' ? (
                        <div className="p-5 rounded-2xl border border-border bg-white dark:bg-card space-y-4 shadow-xs">
                            <div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                    <h3 className="font-semibold text-base text-foreground">
                                        Parish Verification & Security Status (Super Admin Only)
                                    </h3>
                                </div>
                                <p className="text-xs text-muted mt-1">
                                    Govern diocese anti-fraud gates, appointment authorizations, and parish directory visibility.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {/* Verified Active */}
                                <label
                                    className={`relative flex items-start p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                        (formData.status === 'verified_active' || formData.status === 'active')
                                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
                                            : 'border-border hover:border-emerald-200 hover:bg-secondary-50/50 bg-white dark:bg-card'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="parish_status"
                                        value="verified_active"
                                        checked={formData.status === 'verified_active' || formData.status === 'active'}
                                        onChange={() => setFormData({ ...formData, status: 'verified_active' })}
                                        disabled={loading}
                                        className="mt-1 text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                                    />
                                    <div className="ml-3.5 flex-1">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                            <span className="text-sm font-bold text-foreground">Verified Parish</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                                Active
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted mt-1 leading-relaxed">
                                            Cashless GCash/Maya donations and sacrament appointments active
                                        </p>
                                    </div>
                                </label>

                                {/* Unverified / Under Audit */}
                                <label
                                    className={`relative flex items-start p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                        formData.status === 'unverified'
                                            ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs'
                                            : 'border-border hover:border-amber-200 hover:bg-secondary-50/50 bg-white dark:bg-card'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="parish_status"
                                        value="unverified"
                                        checked={formData.status === 'unverified'}
                                        onChange={() => setFormData({ ...formData, status: 'unverified' })}
                                        disabled={loading}
                                        className="mt-1 text-amber-600 focus:ring-amber-500 h-4 w-4 shrink-0"
                                    />
                                    <div className="ml-3.5 flex-1">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                                            <span className="text-sm font-bold text-foreground">Unverified / Under Audit</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                                Anti-Fraud Locked
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted mt-1 leading-relaxed">
                                            Cashless donations frozen by Anti-Fraud Gate
                                        </p>
                                    </div>
                                </label>

                                {/* Inactive */}
                                <label
                                    className={`relative flex items-start p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                        formData.status === 'inactive'
                                            ? 'border-secondary-500 bg-secondary-100/50 dark:bg-secondary-900/30 shadow-xs'
                                            : 'border-border hover:border-secondary-300 hover:bg-secondary-50/50 bg-white dark:bg-card'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="parish_status"
                                        value="inactive"
                                        checked={formData.status === 'inactive'}
                                        onChange={() => setFormData({ ...formData, status: 'inactive' })}
                                        disabled={loading}
                                        className="mt-1 text-secondary-600 focus:ring-secondary-500 h-4 w-4 shrink-0"
                                    />
                                    <div className="ml-3.5 flex-1">
                                        <div className="flex items-center gap-2">
                                            <EyeOff className="w-4 h-4 text-secondary-600" />
                                            <span className="text-sm font-bold text-foreground">Inactive</span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-200 text-secondary-800 dark:bg-secondary-800 dark:text-secondary-300">
                                                Archived
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted mt-1 leading-relaxed">
                                            Archived from public directory
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    ) : (
                        /* Read-only verification status badge for non-super admins */
                        <div className="p-4 rounded-2xl border border-border bg-secondary-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <label className="block text-sm font-semibold text-foreground">
                                    Parish Verification Status
                                </label>
                                <p className="text-xs text-muted mt-0.5">
                                    Verification status is governed by Diocese and Chancery Super Administrators.
                                </p>
                            </div>
                            <div className="shrink-0">
                                {(formData.status === 'verified_active' || formData.status === 'active') && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Verified Parish
                                    </span>
                                )}
                                {formData.status === 'unverified' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                        Unverified / Under Audit
                                    </span>
                                )}
                                {formData.status === 'inactive' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary-200 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200 border border-secondary-300">
                                        <EyeOff className="w-3.5 h-3.5 text-secondary-600" />
                                        Inactive (Archived)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Facebook URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Official Facebook Page
                        </label>
                        <input
                            type="url"
                            value={formData.facebook_url}
                            onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., https://facebook.com/mychurch"
                        />
                    </div>

                    {/* Livestream Section */}
                    <div className="p-4 rounded-xl border border-secondary-200 bg-secondary-50/40 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-semibold">
                                    Livestream Virtual Sanctuary
                                </label>
                                <p className="text-xs text-muted">
                                    Stream YouTube or Facebook Live Mass to parishioners with in-app liturgy and offertory.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_live}
                                    onChange={(e) => setFormData({ ...formData, is_live: e.target.checked })}
                                    disabled={loading}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                <span className="ml-2 text-xs font-bold text-foreground">
                                    {formData.is_live ? '🔴 LIVE' : 'Offline'}
                                </span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Stream Platform
                                </label>
                                <select
                                    value={formData.livestream_platform}
                                    onChange={(e) => setFormData({ ...formData, livestream_platform: e.target.value })}
                                    disabled={loading}
                                    className="input w-full text-xs"
                                >
                                    <option value="youtube">YouTube Live</option>
                                    <option value="facebook">Facebook Live</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">
                                    Stream / Broadcast Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.livestream_title}
                                    onChange={(e) => setFormData({ ...formData, livestream_title: e.target.value })}
                                    disabled={loading}
                                    className="input w-full text-xs"
                                    placeholder="e.g., Sunday 8:00 AM Solemn Mass"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">
                                Livestream Video URL
                            </label>
                            <input
                                type="url"
                                value={formData.livestream_url}
                                onChange={(e) => setFormData({ ...formData, livestream_url: e.target.value })}
                                disabled={loading}
                                className="input w-full text-xs font-mono"
                                placeholder="e.g., https://youtube.com/watch?v=... or https://facebook.com/..."
                            />
                        </div>
                    </div>

                    {/* 360° Panorama Image Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            360° Panorama Image
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={loading || uploading}
                                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary hover:file:bg-primary-100"
                            />
                        </div>
                        {uploading && <p className="text-xs text-primary mt-2">Uploading image...</p>}
                        {formData.panorama_url && !uploading && (
                            <div className="mt-2">
                                <p className="text-xs text-green-600 mb-1">✓ Current image set</p>
                                {/* Preview could go here if needed */}
                            </div>
                        )}
                        <p className="text-xs text-muted mt-1">
                            Upload an equirectangular image for the 360° tour.
                        </p>
                    </div>

                    {/* ── Donation Settings ─────────────────────────── */}
                    <div className="border-t border-border pt-6 space-y-6">
                        <div className="flex items-center gap-2">
                            <Heart className="w-5 h-5 text-red-500" />
                            <h3 className="text-lg font-semibold">Donation Settings</h3>
                        </div>
                        <p className="text-xs text-muted -mt-4">
                            Set up payment methods so members can donate to this church.
                        </p>

                        {/* GCash */}
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
                            <p className="text-sm font-semibold text-blue-700">💙 GCash</p>
                            <div>
                                <label className="block text-xs font-medium text-blue-600 mb-1">GCash Number</label>
                                <input
                                    type="text"
                                    value={formData.gcash_number}
                                    onChange={(e) => setFormData({ ...formData, gcash_number: e.target.value })}
                                    disabled={loading}
                                    className="input w-full"
                                    placeholder="e.g., 0917-123-4567"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-blue-600 mb-1">GCash QR Code</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                                        {formData.gcash_qr_url
                                            ? <img src={formData.gcash_qr_url} alt="GCash QR" className="w-full h-full object-contain" />
                                            : <QrCode className="w-6 h-6 text-blue-200" />}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors">
                                            <QrCode className="w-3.5 h-3.5" />
                                            {uploadingQr ? 'Uploading...' : formData.gcash_qr_url ? 'Replace' : 'Upload QR'}
                                            <input type="file" accept="image/*" onChange={(e) => handleQrUpload('gcash_qr_url', e)} disabled={loading || uploadingQr} className="hidden" />
                                        </label>
                                        {formData.gcash_qr_url && (
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, gcash_qr_url: '' }))} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                                                <X className="w-3 h-3" /> Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Maya */}
                        <div className="p-4 rounded-xl bg-green-50 border border-green-100 space-y-3">
                            <p className="text-sm font-semibold text-green-700">🟢 Maya</p>
                            <div>
                                <label className="block text-xs font-medium text-green-600 mb-1">Maya Number</label>
                                <input
                                    type="text"
                                    value={formData.maya_number}
                                    onChange={(e) => setFormData({ ...formData, maya_number: e.target.value })}
                                    disabled={loading}
                                    className="input w-full"
                                    placeholder="e.g., 0917-987-6543"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-green-600 mb-1">Maya QR Code</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-green-200 flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                                        {formData.maya_qr_url
                                            ? <img src={formData.maya_qr_url} alt="Maya QR" className="w-full h-full object-contain" />
                                            : <QrCode className="w-6 h-6 text-green-200" />}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors">
                                            <QrCode className="w-3.5 h-3.5" />
                                            {uploadingQr ? 'Uploading...' : formData.maya_qr_url ? 'Replace' : 'Upload QR'}
                                            <input type="file" accept="image/*" onChange={(e) => handleQrUpload('maya_qr_url', e)} disabled={loading || uploadingQr} className="hidden" />
                                        </label>
                                        {formData.maya_qr_url && (
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, maya_qr_url: '' }))} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                                                <X className="w-3 h-3" /> Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Church Gallery ────────────────────────────── */}
                    <div className="border-t border-border pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ImageIcon className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold">Church Gallery</h3>
                        </div>
                        <p className="text-sm text-muted mb-6">Upload photos to the gallery and choose one to feature on the church's card.</p>

                        {/* Existing Images */}
                        {galleryImages.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-sm font-medium mb-3">Current Images ({galleryImages.length})</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {galleryImages.map((img) => {
                                        const isFeatured = formData.featured_image_url === img.image_url;
                                        return (
                                            <div key={img.id} className={`relative group rounded-lg overflow-hidden border-2 transition-all ${isFeatured ? 'border-amber-400 shadow-md ring-2 ring-amber-400/20' : 'border-transparent hover:border-border'}`}>
                                                <img
                                                    src={img.image_url}
                                                    alt="Church"
                                                    className="w-full h-32 object-cover"
                                                />
                                                
                                                {/* Featured Badge */}
                                                {isFeatured && (
                                                    <div className="absolute top-0 left-0 bg-amber-400 text-white px-2 py-1 text-[10px] font-bold rounded-br-lg shadow-sm flex items-center gap-1">
                                                        <Star className="w-3 h-3 fill-white" />
                                                        FEATURED
                                                    </div>
                                                )}

                                                <div className="absolute top-2 right-2 flex flex-col gap-2">
                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (confirm('Delete this image?')) {
                                                                await supabase.from('church_images').delete().eq('id', img.id);
                                                                if (isFeatured) {
                                                                    setFormData(prev => ({ ...prev, featured_image_url: '' }));
                                                                }
                                                                fetchGallery();
                                                            }
                                                        }}
                                                        className="bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm backdrop-blur-md"
                                                        title="Delete image"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    
                                                    {/* Set Featured Button */}
                                                    {!isFeatured && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, featured_image_url: img.image_url }))}
                                                            className="bg-gray-900/60 hover:bg-amber-400 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm backdrop-blur-md"
                                                            title="Set as featured image"
                                                        >
                                                            <Star className="w-4 h-4 hover:fill-white" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Upload New Images */}
                        <GalleryUploader
                            churchId={id!}
                            onUploadComplete={fetchGallery}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${id}`)}
                            disabled={loading}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
