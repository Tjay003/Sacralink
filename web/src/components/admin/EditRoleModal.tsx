import { useState } from 'react';
import { directUpdateUserRole } from '../../lib/directApi';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../types/database';

interface EditRoleModalProps {
    user: Profile;
    currentUserRole: string;
    onClose: () => void;
    onSuccess: () => void;
}

/**
 * EditRoleModal - Modal to change a user's role
 * 
 * Permissions:
 * - admin can promote users to 'admin' (but not 'super_admin')
 * - super_admin can set any role
 */
export default function EditRoleModal({ user, currentUserRole, onClose, onSuccess }: EditRoleModalProps) {
    const { session } = useAuth();
    const [selectedRole, setSelectedRole] = useState(user.role);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Determine available roles based on current user's role
    const availableRoles = currentUserRole === 'super_admin'
        ? ['user', 'admin', 'super_admin']
        : ['user', 'admin']; // Regular admins can't create super_admins

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!session) {
            setError('No active session');
            return;
        }

        if (selectedRole === user.role) {
            onClose();
            return;
        }

        setLoading(true);
        setError('');

        const result = await directUpdateUserRole(user.id, selectedRole, session.access_token);

        if (result.success) {
            onSuccess();
        } else {
            setError(result.error || 'Failed to update role');
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
                    <h2 className="text-xl font-bold mb-4">Edit User Role</h2>

                    <div className="mb-4 p-4 bg-secondary-50 rounded-lg">
                        <p className="text-sm text-muted mb-1">User</p>
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="text-sm text-muted">{user.email}</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2">
                                Select New Role
                            </label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                                className="input w-full"
                                disabled={loading}
                            >
                                {availableRoles.map((role) => (
                                    <option key={role} value={role}>
                                        {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </option>
                                ))}
                            </select>
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
                                disabled={loading || selectedRole === user.role}
                            >
                                {loading ? 'Updating...' : 'Update Role'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
