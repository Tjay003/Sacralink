import { useState } from 'react';
import Modal from '../ui/Modal';
import { setUserRole } from '../../lib/supabase/profiles';
import { ASSIGNABLE_ROLES, getRoleEditBlock, isStaffRole, roleLabel } from '../../lib/roleEditing';
import DemoteConfirmModal from './DemoteConfirmModal';
import { useAuth, useIsSuperAdmin, useIsChurchAdmin } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import type { Profile, UserRole } from '../../types/database';
import { ShieldAlert, Lock, AlertCircle, Crown, ArrowRightLeft, Cross } from 'lucide-react';

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
 * - Super Admin: Can set standard roles ('church_admin', 'priest', 'volunteer', 'user') across any church.
 * - Church Admin: Can set the same four roles ONLY for their assigned church (no church picker).
 * - Nobody edits their own role. Changes go through the set_user_role database function.
 * - Super Admin role is immutable via standard role pickers and can ONLY be transferred via TransferOwnershipModal.
 * - Dual-role Priest-Administrators (church_admin who are ordained priests) can be toggled as is_priest.
 * - Dedicated priests (role = 'priest') are automatically is_priest = true.
 */
export default function EditRoleModal({ user, onClose, onSuccess, onOpenTransferModal }: EditRoleModalProps) {
    const { profile: currentProfile } = useAuth();
    const isSuperAdmin = useIsSuperAdmin();
    const isChurchAdmin = useIsChurchAdmin();
    const { churches } = useChurches();

    const [selectedRole, setSelectedRole] = useState(user.role || 'user');
    const [selectedChurchId, setSelectedChurchId] = useState(user.assigned_church_id || '');
    const [isPriest, setIsPriest] = useState<boolean>(user.is_priest ?? (user.role === 'priest'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDemote, setShowDemote] = useState(false);

    // Check if user being edited is currently a super_admin
    const isEditingSuperAdmin = user.role === 'super_admin';
    const isSelf = user.id === currentProfile?.id;
    // The reason this person's role cannot be edited by the current user (null when editing is allowed)
    const editBlock = getRoleEditBlock(currentProfile, user);
    const canEditThisUser = editBlock === null;
    const canDemote = canEditThisUser && isStaffRole(user.role);

    // Platform ownership transfer is available if current user is Super Admin, target is not super admin, and target is not self
    const canTransferOwnership = isSuperAdmin && !isEditingSuperAdmin && !isSelf && !!onOpenTransferModal;

    // Available roles: the same four for a Super Admin and a Church Admin; super_admin and admin are never offered
    const availableRoles = ASSIGNABLE_ROLES;

    // Clergy toggle is available for the church_admin role
    const isClergyToggleEligible = selectedRole === 'church_admin';

    // Handler when role selection changes
    const handleRoleChange = (newRole: UserRole) => {
        setSelectedRole(newRole);
        if (newRole === 'priest') {
            setIsPriest(true);
        }
    };

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

        if (editBlock) {
            setError(editBlock);
            return;
        }

        // A Church Admin is locked to their own church (the database ignores any other value)
        const finalChurchId = isChurchAdmin ? (currentProfile?.assigned_church_id || '') : selectedChurchId;
        if (isStaffRole(selectedRole) && !finalChurchId && !user.assigned_church_id) {
            setError('Choose a church for this staff role.');
            return;
        }

        setLoading(true);
        setError('');

        const finalIsPriest = selectedRole === 'priest' ? true : (isClergyToggleEligible ? isPriest : false);

        try {
            await setUserRole(user.id, selectedRole, finalChurchId || null, finalIsPriest);
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update user');
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

            {!isEditingSuperAdmin && editBlock && (
                <div data-testid="role-edit-blocked" className="mb-4 p-3 bg-secondary-50 border border-border rounded-xl flex items-start gap-2 text-xs text-muted">
                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{editBlock}</span>
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
                        onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                        className="input w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading || !canEditThisUser}
                    >
                        {isEditingSuperAdmin && (
                            <option value="super_admin">Super Admin (Platform Owner)</option>
                        )}
                        {availableRoles.map((role) => (
                            <option key={role} value={role}>
                                {roleLabel(role)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Clergy Notice for Dedicated Priests */}
                {selectedRole === 'priest' && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                        <Cross className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>Dedicated Priest account is automatically authorized as an ordained sacramental celebrant.</span>
                    </div>
                )}

                {/* Clergy Toggle Switch for Administrators */}
                {isClergyToggleEligible && (
                    <div className="p-3.5 rounded-xl border border-border bg-white dark:bg-secondary-900/40 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 transition-colors ${
                                isPriest 
                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' 
                                    : 'bg-secondary-100 dark:bg-secondary-800 text-secondary-500'
                            }`}>
                                <Cross className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <label 
                                    htmlFor="is-priest-toggle" 
                                    className="text-xs font-bold text-foreground block cursor-pointer select-none"
                                >
                                    Ordained Catholic Priest
                                </label>
                                <p className="text-[11px] text-muted leading-relaxed">
                                    Allows this administrator to be assigned as a sacramental celebrant
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            id="is-priest-toggle"
                            role="switch"
                            aria-checked={isPriest}
                            onClick={() => setIsPriest(!isPriest)}
                            disabled={loading || !canEditThisUser}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                )}

                {/* Church Selection */}
                <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                        Church
                    </label>

                    {canSelectChurch ? (
                        <select
                            value={selectedChurchId}
                            onChange={(e) => setSelectedChurchId(e.target.value)}
                            className="input w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={loading || !canEditThisUser}
                        >
                            {!user.assigned_church_id && <option value="">-- No Church Assigned --</option>}
                            {churches.map((church) => (
                                <option key={church.id} value={church.id}>
                                    {church.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="p-3 bg-secondary-50 dark:bg-secondary-900/40 rounded-xl border border-border text-xs">
                            {isEditingSuperAdmin ? (
                                <span className="text-muted">Super Admins manage all churches globally across the platform.</span>
                            ) : isChurchAdmin ? (
                                <span>Locked to: <strong className="text-foreground">{getChurchName(currentProfile?.assigned_church_id || '')}</strong></span>
                            ) : (
                                <span className="text-muted">No church assignment available</span>
                            )}
                        </div>
                    )}

                    {selectedRole === 'church_admin' && !selectedChurchId && canSelectChurch && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Warning: Church Admins should have an assigned church.</span>
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

                {canDemote && (
                    <button
                        type="button"
                        onClick={() => setShowDemote(true)}
                        disabled={loading}
                        className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm"
                    >
                        Demote to Parishioner
                    </button>
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
                        {loading ? 'Saving...' : canEditThisUser ? 'Save Changes' : isEditingSuperAdmin ? 'Super Admin Locked' : 'Not Allowed'}
                    </button>
                </div>
            </form>

            {showDemote && (
                <DemoteConfirmModal
                    user={user}
                    churchName={user.assigned_church_id ? getChurchName(user.assigned_church_id) : null}
                    onClose={() => setShowDemote(false)}
                    onSuccess={onSuccess}
                />
            )}
        </Modal>
    );
}
