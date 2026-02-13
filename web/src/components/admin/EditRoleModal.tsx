import { useState } from 'react';
import { directUpdateProfile } from '../../lib/directApi';
import { useAuth, useIsSuperAdmin, useIsChurchAdmin } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import type { Profile } from '../../types/database';

interface EditRoleModalProps {
    user: Profile;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * EditRoleModal - Modal to change a user's role and assigned church
 * 
 * Permissions:
 * - Super Admin: Can set any role and any church.
 * - Church Admin: Can set limited roles (user, volunteer, church_admin) but ONLY for their church.
 */
export default function EditRoleModal({ user, onClose, onSuccess }: EditRoleModalProps) {
    const { session, profile: currentProfile } = useAuth();
    const isSuperAdmin = useIsSuperAdmin();
    const isChurchAdmin = useIsChurchAdmin();
    const { churches } = useChurches();

    const [selectedRole, setSelectedRole] = useState(user.role || 'user');
    const [selectedChurchId, setSelectedChurchId] = useState(user.assigned_church_id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Check if user being edited is a super_admin
    const isEditingSuperAdmin = user.role === 'super_admin';
    // Only super_admins can edit other super_admins
    const canEditThisUser = !isEditingSuperAdmin || isSuperAdmin;

    // Determine available roles based on current user's role
    const availableRoles = isSuperAdmin
        ? ['user', 'volunteer', 'church_admin', 'admin', 'super_admin']
        : ['user', 'volunteer', 'church_admin']; // Church Admins can only creating regular users or co-admins

    // Determine if church selection is allowed
    // Super Admin can select any church.
    // Church Admin is locked to their own church.
    const canSelectChurch = isSuperAdmin;

    // Function to get display name for church
    const getChurchName = (id: string) => {
        return churches.find(c => c.id === id)?.name || 'Unknown Church';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!session) {
            setError('No active session');
            return;
        }

        // Validate: Church Admin must have a church
        let finalChurchId = selectedChurchId;
        if (isChurchAdmin) {
            finalChurchId = currentProfile?.assigned_church_id || '';
        }

        // If explicitly clearing church (e.g. for super_admin role)
        if (selectedRole === 'super_admin') {
            finalChurchId = ''; // Super Admins don't belong to a specific church usually
        }

        setLoading(true);
        setError('');

        const result = await directUpdateProfile(
            user.id,
            {
                role: selectedRole,
                assigned_church_id: finalChurchId || null
            },
            session.access_token
        );

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || 'Failed to update user');
            setLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="card p-6 max-w-md w-full">
                    <h2 className="text-xl font-bold mb-4">Edit User Access</h2>

                    {/* Super Admin Protection Warning */}
                    {isEditingSuperAdmin && !isSuperAdmin && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 font-medium">🔒 This user is a Super Admin</p>
                            <p className="text-xs text-red-500 mt-1">Only Super Admins can modify Super Admin roles.</p>
                        </div>
                    )}

                    <div className="mb-4 p-4 bg-secondary-50 rounded-lg">
                        <p className="text-sm text-muted mb-1">User</p>
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="text-sm text-muted">{user.email}</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Role Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">
                                Role
                            </label>
                            <select
                                value={selectedRole || 'user'}
                                onChange={(e) => setSelectedRole(e.target.value as any)}
                                className="input w-full"
                                disabled={loading || !canEditThisUser}
                            >
                                {availableRoles.map((role) => (
                                    <option key={role} value={role}>
                                        {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Church Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">
                                Assigned Church
                            </label>

                            {canSelectChurch ? (
                                <select
                                    value={selectedChurchId}
                                    onChange={(e) => setSelectedChurchId(e.target.value)}
                                    className="input w-full"
                                    disabled={loading || selectedRole === 'super_admin' || !canEditThisUser}
                                >
                                    <option value="">-- No Church Assigned --</option>
                                    {churches.map((church) => (
                                        <option key={church.id} value={church.id}>
                                            {church.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 bg-gray-100 rounded border border-gray-200 text-sm">
                                    {isChurchAdmin ? (
                                        <span>Locked to: <strong>{getChurchName(currentProfile?.assigned_church_id || '')}</strong></span>
                                    ) : (
                                        <span className="text-muted">No church assignment available</span>
                                    )}
                                </div>
                            )}

                            {selectedRole === 'church_admin' && !selectedChurchId && canSelectChurch && (
                                <p className="text-xs text-amber-600 mt-1">
                                    ⚠️ Warning: Church Admins should have an assigned church.
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary flex-1"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary flex-1"
                                disabled={loading || !canEditThisUser}
                            >
                                {loading ? 'Saving...' : canEditThisUser ? 'Save Changes' : 'Cannot Edit Super Admin'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
