import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, Shield, Calendar, Heart, CheckCircle, XCircle, Clock, Cross } from 'lucide-react';
import AvatarUpload from '../components/profile/AvatarUpload';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';
import { getCurrentProfile, updateProfile } from '../lib/supabase/profiles';
import { getUserDonations, type Donation } from '../lib/supabase/donations';
import { format, formatDistanceToNow } from 'date-fns';

export default function ProfilePage() {
    const { refreshProfile, profile } = useAuth();
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<any>({ full_name: '', phone_number: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [totalDonated, setTotalDonated] = useState(0);
    const [donationsLoading, setDonationsLoading] = useState(true);

    const [isPriest, setIsPriest] = useState(false);
    const [priestLoading, setPriestLoading] = useState(false);
    const [priestMessage, setPriestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchProfile();
        fetchMyDonations();
    }, []);

    const fetchMyDonations = async () => {
        setDonationsLoading(true);
        const { data, totalDonated: total } = await getUserDonations();
        setDonations(data);
        setTotalDonated(total);
        setDonationsLoading(false);
    };

    const fetchProfile = async () => {
        try {
            const data: any = await getCurrentProfile();
            setProfileData(data);
            setEditedData({
                full_name: data?.full_name || '',
                phone_number: data?.phone_number || ''
            });
            setIsPriest(Boolean(data?.is_priest));
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePriest = async (newValue: boolean) => {
        if (!profileData?.id) return;
        setPriestLoading(true);
        setPriestMessage(null);
        try {
            await updateProfile(profileData.id, { is_priest: newValue });
            setIsPriest(newValue);
            setProfileData((prev: any) => prev ? { ...prev, is_priest: newValue } : prev);
            await refreshProfile();
            setPriestMessage({
                type: 'success',
                text: newValue
                    ? 'Ordained Catholic Priest status activated. Your personal liturgical celebrant calendar is now enabled.'
                    : 'Clergy status updated to inactive.'
            });
            setTimeout(() => setPriestMessage(null), 4000);
        } catch (err: any) {
            console.error('Error toggling clergy status:', err);
            setPriestMessage({
                type: 'error',
                text: err.message || 'Failed to update clergy status'
            });
        } finally {
            setPriestLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        // Validate PH phone number if provided
        const phone = editedData.phone_number?.trim() || '';
        if (phone && !/^(\+639|09)\d{9}$/.test(phone.replace(/\s/g, ''))) {
            setError('Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).');
            setSaving(false);
            return;
        }

        try {
            const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: updateError } = await ((await import('../lib/supabase')).supabase
                .from('profiles') as any)
                .update({
                    full_name: editedData.full_name,
                    phone_number: editedData.phone_number || null
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await fetchProfile();
            await refreshProfile();
            setSuccess(true);
            setIsEditing(false);

            // Hide success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedData({
            full_name: profileData?.full_name || '',
            phone_number: profileData?.phone_number || ''
        });
        setError(null);
        setSuccess(false);
        setIsEditing(false);
    };

    const handleUploadSuccess = () => {
        fetchProfile(); // Refresh profile data
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
                <p className="text-muted">Manage your account information and preferences</p>
            </div>

            {/* Avatar Section */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Profile Picture</h2>
                <AvatarUpload
                    onUploadSuccess={handleUploadSuccess}
                    onDeleteSuccess={handleUploadSuccess}
                />
            </div>

            {/* Personal Information */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Personal Information</h2>
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="btn btn-outline btn-sm"
                        >
                            Edit
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn btn-primary btn-sm"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={saving}
                                className="btn btn-outline btn-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        Profile updated successfully!
                    </div>
                )}

                <div className="space-y-4">
                    {/* Full Name */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Full Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedData.full_name}
                                    onChange={(e) => setEditedData({ ...editedData, full_name: e.target.value })}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter your full name"
                                />
                            ) : (
                                <p className="text-base text-foreground">
                                    {profileData?.full_name || 'Not set'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Email (Read-only) */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <Mail className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Email</label>
                            <p className="text-base text-foreground">
                                {profileData?.email || 'Not set'}
                            </p>
                            <p className="text-xs text-muted mt-1">Email cannot be changed</p>
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <Phone className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Phone Number</label>
                            {isEditing ? (
                                <div>
                                    <input
                                        type="tel"
                                        value={editedData.phone_number || ''}
                                        onChange={(e) => {
                                            // Strip everything except digits and leading +
                                            let raw = e.target.value.replace(/[^0-9+]/g, '');
                                            // Auto-convert 09xx → +639xx
                                            if (raw.startsWith('09')) raw = '+63' + raw.slice(1);
                                            // Enforce max length: +63 + 10 digits = 13
                                            if (raw.length > 13) raw = raw.slice(0, 13);
                                            setEditedData({ ...editedData, phone_number: raw });
                                        }}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="09171234567 or +639171234567"
                                        maxLength={13}
                                        inputMode="tel"
                                    />
                                    <p className="text-xs text-muted mt-1">Philippine mobile number — 11 digits starting with 09, or +639XXXXXXXXXX</p>
                                </div>
                            ) : (
                                <p className="text-base text-foreground">
                                    {profileData?.phone_number || 'Not set'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Role (Read-only) */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <Shield className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Role</label>
                            <p className="text-base text-foreground capitalize">
                                {profileData?.role?.replace('_', ' ') || 'User'}
                            </p>
                        </div>
                    </div>

                    {/* Benefactor Badge — shown when user has at least 1 verified donation */}
                    {donations.some(d => d.status === 'verified') && (
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <Heart className="w-5 h-5 text-rose-500 fill-rose-300" />
                            </div>
                            <div className="flex-1">
                                <label className="text-sm font-medium text-muted">Recognition</label>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                                        🤍 Benefactor
                                    </span>
                                    <span className="text-xs text-muted">Thank you for your generosity!</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Member Since (Read-only) */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg">
                            <Calendar className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-muted">Member Since</label>
                            <p className="text-base text-foreground">
                                {profileData?.created_at
                                    ? format(new Date(profileData.created_at), 'MMMM dd, yyyy')
                                    : 'Unknown'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clergy Status & Presiding Privileges (for Church Admin, Admin, and Super Admin) */}
            {(profileData?.role === 'church_admin' || (profileData?.role as string) === 'super_admin' || profile?.role === 'church_admin' || profile?.role === 'super_admin') && (
                <div className="card p-6 border border-border rounded-2xl shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
                                isPriest 
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' 
                                    : 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400'
                            }`}>
                                <Cross className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="text-lg font-semibold text-foreground">Clergy Status & Presiding Privileges</h2>
                                    {isPriest ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1">
                                            <Cross className="w-3 h-3 text-amber-600" />
                                            Active Celebrant
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">
                                            Administrative Only
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted mt-1 leading-relaxed">
                                    Configure liturgical presiding rights for ordained Catholic priests serving in parish leadership.
                                </p>
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                            {priestLoading && (
                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            )}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPriest}
                                onClick={() => handleTogglePriest(!isPriest)}
                                disabled={priestLoading}
                                aria-label="Toggle Ordained Catholic Priest status"
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isPriest ? 'bg-amber-500' : 'bg-secondary-200 dark:bg-secondary-700'
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isPriest ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Status Message Alert */}
                    {priestMessage && (
                        <div className={`p-3 rounded-xl text-xs font-medium mb-3 border animate-in fade-in ${
                            priestMessage.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
                        }`}>
                            {priestMessage.text}
                        </div>
                    )}

                    <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                        <div className="flex items-start gap-2.5">
                            <Cross className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                                <p className="font-semibold">
                                    Ordained Catholic Priest (Presiding Celebrant)
                                </p>
                                <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                                    Allows you to be assigned as celebrant for sacraments and enables your personal liturgical calendar.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* My Donations */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Heart className="w-5 h-5 text-red-500" />
                        My Donations
                    </h2>
                    {totalDonated > 0 && (
                        <div className="text-right">
                            <p className="text-xs text-muted">Total Donated</p>
                            <p className="text-lg font-bold text-primary">
                                ₱{totalDonated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}
                </div>

                {donationsLoading ? (
                    <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : donations.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                        <Heart className="w-10 h-10 mx-auto mb-2 text-muted/40" />
                        <p className="text-sm">No donations yet.</p>
                        <p className="text-xs mt-1">Visit a church page to make your first donation!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {donations.map(d => {
                            const statusConfig = {
                                pending: { icon: <Clock className="w-3.5 h-3.5" />, cls: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
                                verified: { icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'bg-green-100 text-green-700', label: 'Verified' },
                                rejected: { icon: <XCircle className="w-3.5 h-3.5" />, cls: 'bg-red-100 text-red-700', label: 'Rejected' },
                            };
                            const status = statusConfig[d.status || 'pending'];
                            return (
                                <div key={d.id} className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{(d.church as any)?.name || 'Church'}</p>
                                        <p className="text-xs text-muted">
                                            {d.created_at
                                                ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true })
                                                : ''}
                                        </p>
                                        {d.status === 'rejected' && d.notes && (
                                            <p className="text-xs text-red-600 mt-0.5">Reason: {d.notes}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <p className="font-bold text-sm">₱{Number(d.amount).toLocaleString('en-PH')}</p>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                                            {status.icon}
                                            {status.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Account Actions */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Account Actions</h2>
                <div className="space-y-3">
                    <button
                        onClick={() => setShowChangePasswordModal(true)}
                        className="btn btn-outline w-full sm:w-auto"
                    >
                        Change Password
                    </button>
                    <p className="text-sm text-muted">
                        Update your password to keep your account secure
                    </p>
                </div>
            </div>

            {/* Change Password Modal */}
            {showChangePasswordModal && (
                <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} />
            )}
        </div>
    );
}
