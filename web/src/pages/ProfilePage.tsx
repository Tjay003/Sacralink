import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, Shield, Calendar } from 'lucide-react';
import AvatarUpload from '../components/profile/AvatarUpload';
import ChangePasswordModal from '../components/profile/ChangePasswordModal';
import { getCurrentProfile } from '../lib/supabase/profiles';
import { format } from 'date-fns';

export default function ProfilePage() {
    const { refreshProfile } = useAuth();
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<any>({ full_name: '', phone_number: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const data: any = await getCurrentProfile();
            setProfileData(data);
            setEditedData({
                full_name: data?.full_name || '',
                phone_number: data?.phone_number || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

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
                                <input
                                    type="tel"
                                    value={editedData.phone_number || ''}
                                    onChange={(e) => {
                                        // Only allow numbers and common phone characters (+, -, spaces, parentheses)
                                        const value = e.target.value.replace(/[^0-9+\-() ]/g, '');
                                        setEditedData({ ...editedData, phone_number: value });
                                    }}
                                    onKeyPress={(e) => {
                                        // Prevent non-numeric and non-phone characters
                                        if (!/[0-9+\-() ]/.test(e.key)) {
                                            e.preventDefault();
                                        }
                                    }}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Enter your phone number (e.g., +63 912 345 6789)"
                                    maxLength={20}
                                />
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
