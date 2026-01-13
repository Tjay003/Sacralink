import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { directUpdateProfile } from '../../lib/directApi';

/**
 * ProfilePage - User profile management
 * 
 * Features:
 * - View current profile information
 * - Edit name and church affiliation
 * - Cannot edit email (Supabase auth limitation)
 * - Cannot edit own role (security)
 */
export default function ProfilePage() {
    const { profile, session, refreshProfile } = useAuth();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        full_name: profile?.full_name || '',
        church_id: profile?.church_id || null,
    });

    // Update form when profile changes
    useEffect(() => {
        if (profile) {
            setFormData({
                full_name: profile.full_name || '',
                church_id: profile.church_id || null,
            });
        }
    }, [profile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log('🔍 Form submit triggered, editing:', editing, 'loading:', loading);

        // Don't submit if not in editing mode
        if (!editing) {
            console.log('⚠️ Not in editing mode, ignoring submit');
            return;
        }

        if (!session || !profile) {
            setError('No active session');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        const result = await directUpdateProfile(
            profile.id,
            formData,
            session.access_token
        );

        if (result.success) {
            setSuccess('Profile updated successfully!');
            setEditing(false);
            // Refresh profile to show updated data
            await refreshProfile();
        } else {
            setError(result.error || 'Failed to update profile');
        }

        setLoading(false);
    };

    const handleCancel = () => {
        // Reset form to current profile data
        if (profile) {
            setFormData({
                full_name: profile.full_name || '',
                church_id: profile.church_id || null,
            });
        }
        setEditing(false);
        setError('');
        setSuccess('');
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-muted">Manage your account information</p>
            </div>

            {/* Profile Card */}
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
                    {/* Profile Picture Placeholder */}
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">
                                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div>
                            <p className="font-semibold">{profile?.full_name || 'User'}</p>
                            <p className="text-sm text-muted capitalize">
                                {profile?.role?.replace('_', ' ') || 'User'}
                            </p>
                        </div>
                    </div>

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            disabled={!editing || loading}
                            className={`input w-full ${!editing ? 'bg-secondary-50 cursor-not-allowed' : ''}`}
                            placeholder="Enter your full name"
                            required
                        />
                        {!editing && (
                            <p className="text-xs text-muted mt-1">
                                Click "Edit Profile" to make changes
                            </p>
                        )}
                    </div>

                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="input w-full bg-secondary-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-muted mt-1">
                            Email cannot be changed. Contact support if needed.
                        </p>
                    </div>

                    {/* Role (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Role
                        </label>
                        <input
                            type="text"
                            value={profile?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
                            disabled
                            className="input w-full bg-secondary-50 cursor-not-allowed capitalize"
                        />
                        <p className="text-xs text-muted mt-1">
                            Only administrators can change user roles.
                        </p>
                    </div>

                    {/* Church Affiliation (Optional for now) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Church Affiliation
                        </label>
                        <input
                            type="text"
                            value={formData.church_id || 'Not assigned'}
                            disabled
                            className="input w-full bg-secondary-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-muted mt-1">
                            Church assignment is managed by administrators.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        {!editing ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('✏️ Edit Profile clicked');
                                    setEditing(true);
                                }}
                                className="btn-primary"
                            >
                                Edit Profile
                            </button>
                        ) : (
                            <>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary flex-1"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Account Info */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Account Information</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted">User ID:</span>
                        <span className="font-mono text-xs">{profile?.id}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Account Created:</span>
                        <span>
                            {profile?.created_at
                                ? new Date(profile.created_at).toLocaleDateString()
                                : 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted">Last Updated:</span>
                        <span>
                            {profile?.updated_at
                                ? new Date(profile.updated_at).toLocaleDateString()
                                : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
