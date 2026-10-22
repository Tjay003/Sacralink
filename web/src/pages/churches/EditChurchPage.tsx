import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../hooks/useChurches';
import {
    ArrowLeft,
    X,
    Heart,
    QrCode,
    Star,
    ShieldCheck,
    ShieldAlert,
    EyeOff,
    CheckCircle2,
    Clock,
    MapPin,
    Radio,
    ChevronRight,
    Navigation,
    ExternalLink,
    UploadCloud,
    Loader2
} from 'lucide-react';
import GalleryUploader from '../../components/churches/GalleryUploader';
import ChurchLocationPicker from '../../components/churches/ChurchLocationPicker';
import ServicesAndDocumentsManager from '../../components/churches/ServicesAndDocumentsManager';
import { useAuth } from '../../contexts/AuthContext';
import type { Tables } from '../../types/database';

type ChurchStatus = 'verified_active' | 'unverified' | 'inactive' | 'active';

/**
 * EditChurchPage - Form to edit an existing parish / church
 * Redesigned to match the modern two-column layout from the Super Admin Console design.
 */
export default function EditChurchPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { church, loading: loadingChurch } = useChurch(id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const isSuperAdmin = profile?.role === 'super_admin';
    // Services & Documents: the parish church admin, admin and super admin (row level security is the real guard)
    const canManageServices = profile?.role === 'super_admin' || profile?.role === 'church_admin';

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        patron_saint: '', // Retained for display in form & preview (safe UI field)
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
    const [qrError, setQrError] = useState('');
    const [qrSuccess, setQrSuccess] = useState('');
    const [uploading, setUploading] = useState(false);
    const [galleryImages, setGalleryImages] = useState<Tables<'church_images'>[]>([]);

    const panoramaInputRef = useRef<HTMLInputElement>(null);

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
                patron_saint: (church as { patron_saint?: string | null }).patron_saint || church.name || '',
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
    const canAccess = () => {
        if (!profile) return false;
        if (profile.role === 'super_admin') return true;

        if (id && profile.role) {
            const userChurchId = profile.assigned_church_id || profile.church_id;
            const staffRoles: string[] = ['church_admin', 'priest'];
            if (staffRoles.includes(profile.role) && userChurchId === id) {
                return true;
            }
        }

        return false;
    };

    if (profile && !canAccess()) {
        return <Navigate to={profile.role === 'volunteer' && id ? `/churches/${id}` : '/churches'} replace />;
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
        e.target.value = '';

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setQrError('Only JPEG, PNG, or WebP images are supported.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setQrError('File size exceeds 5MB limit. Please choose a smaller image.');
            return;
        }

        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${id}/${field}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        setUploadingQr(true);
        setError('');
        setQrError('');
        setQrSuccess('');

        try {
            let uploadBucket = 'church-images';
            const { error: uploadError } = await supabase.storage
                .from(uploadBucket)
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.warn('Upload to church-images failed, trying donation-qr bucket:', uploadError);
                uploadBucket = 'donation-qr';
                const retry = await supabase.storage
                    .from(uploadBucket)
                    .upload(fileName, file, { upsert: true });
                if (retry.error) throw retry.error;
            }

            const { data } = supabase.storage.from(uploadBucket).getPublicUrl(fileName);
            setFormData(prev => ({ ...prev, [field]: data.publicUrl }));
            const label = field === 'gcash_qr_url' ? 'GCash QR' : 'Maya QR';
            setQrSuccess(`✓ ${label} uploaded! Click "Save changes" below to apply.`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to upload QR image';
            setError('Failed to upload QR image: ' + message);
            setQrError('Failed to upload QR image: ' + message);
        } finally {
            setUploadingQr(false);
        }
    };

    const handleBrowserGps = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: Number(pos.coords.latitude.toFixed(6)),
                    longitude: Number(pos.coords.longitude.toFixed(6)),
                }));
            },
            (err) => {
                setError('Could not retrieve GPS location: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Church name is required');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!formData.address.trim()) {
            setError('Address is required');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const contact = formData.contact_number.trim();
        if (contact && !/^(\+639|09)\d{9}$/.test(contact.replace(/\s/g, ''))) {
            setError('Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!id) return;

        setLoading(true);
        setError('');
        setSuccess('');

        try {
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
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            setSuccess('Parish details updated successfully!');
            setTimeout(() => {
                navigate(`/churches/${id}`);
            }, 1000);
        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to update church');
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (loadingChurch) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted">Loading parish details...</p>
                </div>
            </div>
        );
    }

    if (!church) {
        return (
            <div className="max-w-xl mx-auto py-12 px-4">
                <button
                    onClick={() => navigate('/churches')}
                    className="inline-flex items-center text-sm text-muted hover:text-foreground mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Parishes
                </button>
                <div className="card p-8 text-center bg-white border border-border rounded-2xl shadow-xs">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
                        <X className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground mb-1">Parish not found</h2>
                    <p className="text-sm text-muted">The requested parish record does not exist or has been removed.</p>
                </div>
            </div>
        );
    }

    const isUnverified = formData.status === 'unverified';

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-7xl mx-auto pb-16">
            <div className="space-y-6">

                {/* ── Breadcrumb & Page Header ───────────────────────── */}
                <div className="space-y-2">
                    <nav className="flex items-center gap-1.5 text-xs text-muted">
                        <Link to="/churches" className="hover:text-primary transition-colors">
                            Parishes
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <Link to={`/churches/${id}`} className="hover:text-primary transition-colors max-w-[200px] sm:max-w-xs truncate">
                            {formData.name || 'Parish'}
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span className="text-foreground font-medium">Edit details</span>
                    </nav>

                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
                            Edit parish details
                        </h1>
                        <p className="text-xs sm:text-sm text-muted mt-1">
                            Changes appear on the parish page and are saved in the audit trail.
                        </p>
                    </div>
                </div>

                {/* ── Alerts ─────────────────────────────────────────── */}
                {success && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-medium">{success}</span>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm flex items-center gap-2.5 animate-in fade-in duration-200">
                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* ── Two-Column Grid ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ═══════════════════════════════════════════════════
                        LEFT COLUMN (Main Form Fields)
                        ═══════════════════════════════════════════════════ */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* 1. Identity Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground tracking-tight">Identity</h2>
                                <p className="text-xs text-muted mt-0.5">How the parish is named and described</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Parish name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        disabled={loading}
                                        placeholder="e.g., Quasi-Parish of Our Lady of La Salette"
                                        className="input w-full text-sm font-medium"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Patron saint or title
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.patron_saint}
                                        onChange={(e) => setFormData({ ...formData, patron_saint: e.target.value })}
                                        disabled={loading}
                                        placeholder="e.g., Our Lady of La Salette"
                                        className="input w-full text-sm"
                                    />
                                    <p className="text-[11px] text-muted mt-1">
                                        Feast title or official patronage of the altar and sanctuary.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        disabled={loading}
                                        rows={5}
                                        placeholder="A concise description of the parish community, history, and weekly devotions..."
                                        className="input w-full h-auto min-h-[140px] py-2.5 text-sm resize-y leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Location Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground tracking-tight">Location</h2>
                                <p className="text-xs text-muted mt-0.5">Search for the address, then fine tune the pin</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-semibold text-foreground">
                                            Address <span className="text-red-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleBrowserGps}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg transition-colors border border-primary-200 cursor-pointer"
                                            title="Use your device's GPS"
                                        >
                                            <Navigation className="w-3.5 h-3.5 text-primary" />
                                            <span>Use current GPS</span>
                                        </button>
                                    </div>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        disabled={loading}
                                        rows={3}
                                        placeholder="Full postal address or street landmark"
                                        className="input w-full h-auto min-h-[90px] py-2.5 text-sm leading-relaxed"
                                        required
                                    />
                                </div>

                                {/* Map Picker with Pin status */}
                                <div className="rounded-2xl border border-border/80 overflow-hidden bg-secondary-50/40 p-4">
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
                            </div>
                        </div>

                        {/* 3. Contact Channels Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground tracking-tight">Contact channels</h2>
                                <p className="text-xs text-muted mt-0.5">Shown to parishioners on the parish page</p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Phone
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
                                            placeholder="+63 9XX XXX XXXX"
                                            className="input w-full text-sm font-mono"
                                            maxLength={13}
                                            inputMode="tel"
                                        />
                                        <p className="text-[10px] text-muted mt-1">e.g. 09171234567 or +639171234567</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            disabled={loading}
                                            placeholder="parish@gmail.com"
                                            className="input w-full text-sm"
                                        />
                                        <p className="text-[10px] text-muted mt-1">Official parish rectory inbox</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Facebook page
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.facebook_url}
                                        onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                                        disabled={loading}
                                        placeholder="e.g., LaSaletteQuasiParishMuzonOfficial or https://facebook.com/..."
                                        className="input w-full text-sm"
                                    />
                                    <p className="text-[11px] text-muted mt-1">
                                        Parish Facebook handle or link for automated feed integration.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 4. Livestream Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground tracking-tight">Livestream</h2>
                                <p className="text-xs text-muted mt-0.5">Broadcast Masses on the parish page</p>
                            </div>

                            <div className="p-4 rounded-xl border border-secondary-200 bg-secondary-50/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.is_live ? 'bg-red-100 text-red-600' : 'bg-secondary-100 text-secondary-600'}`}>
                                            <Radio className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">
                                                Enable livestream
                                            </p>
                                            <p className="text-[11px] text-muted">
                                                Broadcast YouTube or Facebook Live Mass to homebound parishioners
                                            </p>
                                        </div>
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
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1">
                                            Stream platform
                                        </label>
                                        <select
                                            value={formData.livestream_platform}
                                            onChange={(e) => setFormData({ ...formData, livestream_platform: e.target.value })}
                                            disabled={loading}
                                            className="input w-full text-xs font-medium"
                                        >
                                            <option value="youtube">YouTube Live</option>
                                            <option value="facebook">Facebook Live</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-foreground mb-1">
                                            Stream / broadcast title
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.livestream_title}
                                            onChange={(e) => setFormData({ ...formData, livestream_title: e.target.value })}
                                            disabled={loading}
                                            placeholder="e.g., Sunday 8:00 AM Solemn Mass"
                                            className="input w-full text-xs"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-foreground mb-1">
                                            Livestream video URL
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.livestream_url}
                                            onChange={(e) => setFormData({ ...formData, livestream_url: e.target.value })}
                                            disabled={loading}
                                            placeholder="e.g., https://youtube.com/watch?v=... or https://facebook.com/..."
                                            className="input w-full text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 5. Donation Channels Card (Preserving all GCash/Maya & Fraud Checks) */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-red-500" />
                                        <h2 className="text-lg font-semibold text-foreground tracking-tight">
                                            Donation Channels & Offertory
                                        </h2>
                                    </div>
                                    <p className="text-xs text-muted mt-0.5">
                                        Configure GCash and Maya QR codes for cashless parish support
                                    </p>
                                </div>
                            </div>

                            {/* Inline QR Alerts */}
                            {qrError && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                                    <span>{qrError}</span>
                                </div>
                            )}
                            {qrSuccess && (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>{qrSuccess}</span>
                                </div>
                            )}

                            {isUnverified && (
                                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-semibold">Anti-Fraud Shield Active:</span> Your parish is currently <em>Unverified / Under Audit</em>. You can upload and save your GCash/Maya QR codes now to assist verification. Note that cashless giving options remain hidden from parishioners until approved by a Super Admin.
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* GCash Card */}
                                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-blue-700">💙 GCash Offertory</span>
                                        <span className="text-[10px] text-blue-600 font-medium">Philippine E-Wallet</span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                                            GCash Account Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.gcash_number}
                                            onChange={(e) => setFormData({ ...formData, gcash_number: e.target.value })}
                                            disabled={loading}
                                            className="input w-full text-xs font-mono"
                                            placeholder="e.g., 0917-123-4567"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                                            GCash QR Code
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-200 flex items-center justify-center overflow-hidden bg-white shrink-0 shadow-xs">
                                                {formData.gcash_qr_url ? (
                                                    <img src={formData.gcash_qr_url} alt="GCash QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <QrCode className="w-6 h-6 text-blue-300" />
                                                )}
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors">
                                                    <QrCode className="w-3.5 h-3.5" />
                                                    <span>{uploadingQr ? 'Uploading...' : formData.gcash_qr_url ? 'Replace QR' : 'Upload QR'}</span>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        onChange={(e) => handleQrUpload('gcash_qr_url', e)}
                                                        disabled={loading || uploadingQr}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <p className="text-[10px] text-muted">PNG, JPG, WebP up to 5MB</p>
                                                {formData.gcash_qr_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(p => ({ ...p, gcash_qr_url: '' }))}
                                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                                                    >
                                                        <X className="w-3 h-3" /> Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Maya Card */}
                                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-emerald-700">🟢 Maya Offertory</span>
                                        <span className="text-[10px] text-emerald-600 font-medium">Philippine E-Wallet</span>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                                            Maya Account Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.maya_number}
                                            onChange={(e) => setFormData({ ...formData, maya_number: e.target.value })}
                                            disabled={loading}
                                            className="input w-full text-xs font-mono"
                                            placeholder="e.g., 0917-987-6543"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                                            Maya QR Code
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-emerald-200 flex items-center justify-center overflow-hidden bg-white shrink-0 shadow-xs">
                                                {formData.maya_qr_url ? (
                                                    <img src={formData.maya_qr_url} alt="Maya QR" className="w-full h-full object-contain" />
                                                ) : (
                                                    <QrCode className="w-6 h-6 text-emerald-300" />
                                                )}
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors">
                                                    <QrCode className="w-3.5 h-3.5" />
                                                    <span>{uploadingQr ? 'Uploading...' : formData.maya_qr_url ? 'Replace QR' : 'Upload QR'}</span>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        onChange={(e) => handleQrUpload('maya_qr_url', e)}
                                                        disabled={loading || uploadingQr}
                                                        className="hidden"
                                                    />
                                                </label>
                                                <p className="text-[10px] text-muted">PNG, JPG, WebP up to 5MB</p>
                                                {formData.maya_qr_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(p => ({ ...p, maya_qr_url: '' }))}
                                                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                                                    >
                                                        <X className="w-3 h-3" /> Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 6. Media Card (360° Panorama + Gallery) */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground tracking-tight">Media</h2>
                                <p className="text-xs text-muted mt-0.5">360° panorama and gallery photos</p>
                            </div>

                            {/* 360° Panorama Upload Area */}
                            <div className="border border-dashed border-border rounded-2xl p-6 text-center bg-secondary-50/40 hover:bg-secondary-50 transition-colors">
                                <div className="w-10 h-10 rounded-full bg-white border border-border shadow-xs flex items-center justify-center mx-auto mb-2.5 text-muted">
                                    <UploadCloud className="w-5 h-5 text-primary" />
                                </div>
                                <h3 className="text-xs font-bold text-foreground">360° panorama</h3>
                                <p className="text-[11px] text-muted mt-0.5 mb-3">
                                    Upload an equirectangular image, at least 4000 px wide
                                </p>

                                <input
                                    ref={panoramaInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={loading || uploading}
                                    className="hidden"
                                />

                                <button
                                    type="button"
                                    onClick={() => panoramaInputRef.current?.click()}
                                    disabled={loading || uploading}
                                    className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border bg-white hover:bg-secondary-50 text-foreground shadow-xs transition-colors cursor-pointer"
                                >
                                    {uploading ? 'Uploading...' : 'Choose file'}
                                </button>

                                {formData.panorama_url && !uploading && (
                                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-600 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Current 360° tour panorama set</span>
                                    </div>
                                )}
                            </div>

                            {/* Gallery Section */}
                            <div className="space-y-3 pt-2 border-t border-border/70">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                                        Gallery Photos ({galleryImages.length})
                                    </span>
                                </div>

                                {galleryImages.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {galleryImages.map((img, idx) => {
                                            const isFeatured = formData.featured_image_url === img.image_url;
                                            return (
                                                <div
                                                    key={img.id}
                                                    className={`group relative rounded-xl overflow-hidden border transition-all bg-secondary-50 aspect-video sm:aspect-square ${
                                                        isFeatured
                                                            ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                                                            : 'border-border hover:border-primary/40'
                                                    }`}
                                                >
                                                    <img
                                                        src={img.image_url}
                                                        alt={`Gallery photo ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />

                                                    {/* Featured Badge */}
                                                    {isFeatured && (
                                                        <div className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold rounded-md shadow-xs flex items-center gap-1">
                                                            <Star className="w-3 h-3 fill-white" />
                                                            Featured
                                                        </div>
                                                    )}

                                                    {/* Action Overlay */}
                                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        {!isFeatured && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(prev => ({ ...prev, featured_image_url: img.image_url }))}
                                                                className="w-7 h-7 rounded-full bg-black/60 hover:bg-amber-500 text-white flex items-center justify-center backdrop-blur-xs transition-colors shadow-xs cursor-pointer"
                                                                title="Set as featured cover"
                                                            >
                                                                <Star className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (confirm('Delete this image from gallery?')) {
                                                                    await supabase.from('church_images').delete().eq('id', img.id);
                                                                    if (isFeatured) {
                                                                        setFormData(prev => ({ ...prev, featured_image_url: '' }));
                                                                    }
                                                                    fetchGallery();
                                                                }
                                                            }}
                                                            className="w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-xs transition-colors shadow-xs cursor-pointer"
                                                            title="Delete photo"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center rounded-xl border border-dashed border-border text-xs text-muted">
                                        No gallery photos added yet. Upload photos below.
                                    </div>
                                )}

                                {/* Gallery Uploader */}
                                <div className="pt-2">
                                    <GalleryUploader
                                        churchId={id!}
                                        onUploadComplete={fetchGallery}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 7. Services & Documents Card */}
                        {canManageServices && id && <ServicesAndDocumentsManager churchId={id} />}

                    </div>

                    {/* ═══════════════════════════════════════════════════
                        RIGHT COLUMN / SIDEBAR
                        ═══════════════════════════════════════════════════ */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">

                        {/* 1. Verification Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-semibold text-foreground tracking-tight">
                                    Verification
                                </h2>
                                {isSuperAdmin ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
                                        Super Admin Edit
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary-600 bg-secondary-100 px-2.5 py-0.5 rounded-full border border-secondary-200">
                                        Read-only
                                    </span>
                                )}
                            </div>

                            {isSuperAdmin ? (
                                <div className="space-y-2.5">
                                    <p className="text-xs text-muted leading-relaxed">
                                        As Super Administrator, select the canonical verification status for this parish:
                                    </p>

                                    {/* Option 1: Verified */}
                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'verified_active' }))}
                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                            formData.status === 'verified_active' || formData.status === 'active'
                                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20 shadow-xs'
                                                : 'border-border/80 bg-white hover:border-secondary-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">Verified</span>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                formData.status === 'verified_active' || formData.status === 'active'
                                                    ? 'border-emerald-600'
                                                    : 'border-secondary-300'
                                            }`}>
                                                {(formData.status === 'verified_active' || formData.status === 'active') && (
                                                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-secondary-600 leading-relaxed pl-8">
                                            Listed in public directory, appointments & donations enabled.
                                        </p>
                                    </div>

                                    {/* Option 2: Under audit */}
                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'unverified' }))}
                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                            formData.status === 'unverified'
                                                ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/20 shadow-xs'
                                                : 'border-border/80 bg-white hover:border-secondary-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                                                    <Clock className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">Under audit</span>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                formData.status === 'unverified'
                                                    ? 'border-amber-600'
                                                    : 'border-secondary-300'
                                            }`}>
                                                {formData.status === 'unverified' && (
                                                    <div className="w-2 h-2 rounded-full bg-amber-600" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-secondary-600 leading-relaxed pl-8">
                                            Undergoing verification. Visible, but sacramental appointments paused.
                                        </p>
                                    </div>

                                    {/* Option 3: Inactive */}
                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'inactive' }))}
                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                            formData.status === 'inactive'
                                                ? 'border-secondary-500 bg-secondary-100/50 ring-2 ring-secondary-500/20 shadow-xs'
                                                : 'border-border/80 bg-white hover:border-secondary-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-secondary-100 text-secondary-600 flex items-center justify-center">
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-foreground">Inactive</span>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                formData.status === 'inactive'
                                                    ? 'border-secondary-600'
                                                    : 'border-secondary-300'
                                            }`}>
                                                {formData.status === 'inactive' && (
                                                    <div className="w-2 h-2 rounded-full bg-secondary-600" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-secondary-600 leading-relaxed pl-8">
                                            Hidden from public directory.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Read-Only Status Pill */}
                                    <div>
                                        {(formData.status === 'verified_active' || formData.status === 'active') && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                ✓ Verified parish
                                            </span>
                                        )}
                                        {formData.status === 'unverified' && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                Under audit
                                            </span>
                                        )}
                                        {formData.status === 'inactive' && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-700 border border-secondary-300">
                                                <EyeOff className="w-3.5 h-3.5 text-secondary-600" />
                                                Inactive
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted leading-relaxed">
                                        Parish verification and canonical accreditation status is managed exclusively by Super Administrators.
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => navigate(`/churches/${id}?tab=governance`)}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors shadow-xs cursor-pointer"
                            >
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                <span>View Governance Record</span>
                            </button>
                        </div>

                        {/* 2. Preview Card */}
                        <div className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                            <div>
                                <h2 className="text-base font-semibold text-foreground tracking-tight">Preview</h2>
                                <p className="text-xs text-muted mt-0.5">How the parish appears in the directory</p>
                            </div>

                            <div className="rounded-xl border border-border p-4 bg-secondary-50/30 space-y-3">
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-serif font-bold text-base text-foreground leading-snug">
                                            {formData.name || 'Parish Name'}
                                        </h3>
                                        {(formData.status === 'verified_active' || formData.status === 'active') && (
                                            <span className="shrink-0 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                Verified
                                            </span>
                                        )}
                                        {formData.status === 'unverified' && (
                                            <span className="shrink-0 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                                Under audit
                                            </span>
                                        )}
                                        {formData.status === 'inactive' && (
                                            <span className="shrink-0 text-[10px] font-semibold bg-secondary-100 text-secondary-600 border border-secondary-300 px-2 py-0.5 rounded-full">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-start gap-1.5 text-xs text-muted mt-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">
                                            {formData.address || 'Parish address will be shown here.'}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-xs text-secondary-600 dark:text-secondary-400 line-clamp-4 leading-relaxed pt-2 border-t border-border/60">
                                    {formData.description || 'No description provided yet. Add a brief description in the identity card to tell parishioners about this parish.'}
                                </p>

                                <div className="pt-1 flex items-center justify-between text-[11px] text-primary">
                                    <span className="font-medium">Directory View</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {/* ── Bottom Floating Action Bar (Island Dock) ────────────────────────────── */}
            <div className="sticky bottom-5 z-40 max-w-4xl mx-auto rounded-2xl border border-border/90 bg-white/90 dark:bg-card/90 backdrop-blur-md shadow-2xl px-6 py-3.5 mt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Changes are saved to the audit trail</span>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${id}`)}
                            disabled={loading}
                            className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors shadow-xs w-full sm:w-auto cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary px-5 py-2 text-xs font-semibold rounded-xl shadow-xs w-full sm:w-auto cursor-pointer"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving changes...
                                </span>
                            ) : (
                                'Save changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
