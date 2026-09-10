import { useState } from 'react';
import Modal from '../ui/Modal';
import { directUpdateProfile } from '../../lib/directApi';
import { useAuth, useIsSuperAdmin, useIsChurchAdmin } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import type { Profile, UserRole } from '../../types/database';
import { ShieldAlert, Lock, AlertCircle, Crown, ArrowRightLeft } from 'lucide-react';

interface EditRoleModalProps {
    user: Profile;
    onClose: () => void;
    onSuccess: () => void;
    onOpenTransferModal?: (user: Profile) => void;
}

/**
 * EditRoleModal - Modal to change a user's role and assigned church
 * 
 * Permissions & Invariants:
 * - Super Admin: Can set standard roles ('admin', 'church_admin', 'volunteer', 'user') across any church.
 * - Church Admin: Can set limited roles ('user', 'volunteer', 'church_admin') ONLY for their assigned church.
 * - Super Admin role is immutable via standard role pickers and can ONLY be transferred via TransferOwnershipModal.
 */
export default function EditRoleModal({ user, onClose, onSuccess, onOpenTransferModal }: EditRoleModalProps) {
    const { session, profile: currentProfile } = useAuth();
    const isSuperAdmin = useIsSuperAdmin();
    const isChurchAdmin = useIsChurchAdmin();
    const { churches } = useChurches();

    const [selectedRole, setSelectedRole] = useState(user.role || 'user');
    const [selectedChurchId, setSelectedChurchId] = useState(user.assigned_church_id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Check if user being edited is currently a super_admin
    const isEditingSuperAdmin = user.role === 'super_admin';
    const isSelf = user.id === currentProfile?.id;
    // Super Admin accounts cannot have their role modified via standard edit role forms
    const canEditThisUser = !isEditingSuperAdmin;

    // Platform ownership transfer is available if current user is Super Admin, target is not super admin, and target is not self
    const canTransferOwnership = isSuperAdmin && !isEditingSuperAdmin && !isSelf && !!onOpenTransferModal;

    // Available roles: super_admin is strictly excluded for all callers
    const availableRoles = isSuperAdmin
        ? ['user', 'volunteer', 'church_admin', 'admin']
        : ['user', 'volunteer', 'church_admin'];

    // Determine if church selection is allowed
    // Super Admin can select any church.
    // Church Admin is locked to their own church.
    const canSelectChurch = isSuperAdmin && !isEditingSuperAdmin;

    // Function to get display name for church
    const getChurchName = (id: string) => {
        return churches.find(c => c.id === id)?.name || 'Unknown Church';
    };

    const handleTransferClick = () => {
        onClose();
        if (onOpenTransferModal) {
            onOpenTransferModal(user);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isEditingSuperAdmin) {
            setError('Super Admin role cannot be modified via standard role editing. Use Transfer Ownership.');
            return;
        }

        if (!session) {
            setError('No active session');
            return;
        }

        // Validate: Church Admin must have a church
        let finalChurchId = selectedChurchId;
        if (isChurchAdmin) {
            finalChurchId = currentProfile?.assigned_church_id || '';
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
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Edit User Access"
            size="md"
        >
            {/* Super Admin Protection Banner */}
            {isEditingSuperAdmin && (
                <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
                        <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <span>Platform Owner (Sole Super Admin)</span>
                    </div>
                    <p className="text-xs text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                        This user holds the sole Super Admin role. Super Admin privileges cannot be modified or reassigned through standard role editing. To assign a new Super Admin, use the dedicated <strong>Transfer Ownership</strong> action.
                    </p>
                </div>
            )}

            <div className="mb-5 p-4 bg-secondary-50 dark:bg-secondary-900/40 rounded-xl border border-border">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">User Account</p>
                <p className="font-bold text-foreground text-base">{user.full_name || 'Unnamed User'}</p>
                <p className="text-xs text-muted mt-0.5">{user.email}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role Selection */}
                <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                        Role
                    </label>
                    <select
                        value={selectedRole || 'user'}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="input w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading || !canEditThisUser}
                    >
                        {isEditingSuperAdmin && (
                            <option value="super_admin">Super Admin (Platform Owner)</option>
                        )}
                        {availableRoles.map((role) => (
                            <option key={role} value={role}>
                                {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Church Selection */}
                <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                        Assigned Parish
                    </label>

                    {canSelectChurch ? (
                        <select
                            value={selectedChurchId}
                            onChange={(e) => setSelectedChurchId(e.target.value)}
                            className="input w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={loading || !canEditThisUser}
                        >
                            <option value="">-- No Church Assigned --</option>
                            {churches.map((church) => (
                                <option key={church.id} value={church.id}>
                                    {church.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="p-3 bg-secondary-50 dark:bg-secondary-900/40 rounded-xl border border-border text-xs">
                            {isEditingSuperAdmin ? (
                                <span className="text-muted">Super Admins manage all parishes globally across the platform.</span>
                            ) : isChurchAdmin ? (
                                <span>Locked to: <strong className="text-foreground">{getChurchName(currentProfile?.assigned_church_id || '')}</strong></span>
                            ) : (
                                <span className="text-muted">No parish assignment available</span>
                            )}
                        </div>
                    )}

                    {selectedRole === 'church_admin' && !selectedChurchId && canSelectChurch && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Warning: Church Admins should have an assigned parish.</span>
                        </p>
                    )}
                </div>

                {/* Platform Ownership Transfer Card */}
                {canTransferOwnership && (
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
                                <Crown className="w-4 h-4" />
                            </div>
                            <div className="space-y-1 min-w-0">
                                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                    Platform Ownership Transfer
                                </h4>
                                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                                    The Super Admin role is unique and cannot be selected from the role dropdown above. However, platform ownership can be transferred to this user.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleTransferClick}
                            className="w-full py-2 px-3.5 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-white dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 hover:bg-amber-100/80 dark:hover:bg-amber-900/80 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow"
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>Transfer Ownership to this User</span>
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
                    </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white dark:bg-secondary-800 hover:bg-secondary-100 dark:hover:bg-secondary-700 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                        disabled={loading}
                    >
                        {isEditingSuperAdmin ? 'Close' : 'Cancel'}
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        disabled={loading || !canEditThisUser}
                    >
                        {loading ? 'Saving...' : canEditThisUser ? 'Save Changes' : 'Super Admin Locked'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
