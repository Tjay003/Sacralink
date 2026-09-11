import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Modal from '../ui/Modal';
import PasswordStrengthIndicator from '../auth/PasswordStrengthIndicator';
import { validatePassword } from '../../utils/passwordValidation';

interface ChangePasswordModalProps {
    onClose: () => void;
}

/**
 * ChangePasswordModal - Modal for changing user password
 * 
 * Features:
 * - Current password verification
 * - Real-time password strength indicator
 * - Confirm password matching
 * - Password visibility toggle
 * - Comprehensive validation
 */
export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            setError(`Password requirements not met:\n${validation.errors.join('\n')}`);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (currentPassword === newPassword) {
            setError('New password must be different from current password');
            return;
        }

        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('No user found');

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                throw new Error('Current password is incorrect');
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error('Error changing password:', err);
            setError(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-base sm:text-xl font-bold text-foreground break-words min-w-0">Change Password</h2>
                </div>
            }
            size="md"
        >
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 whitespace-pre-line">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Password changed successfully!
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5">Current Password</label>
                    <div className="relative">
                        <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="input w-full pr-10"
                            placeholder="Enter your current password"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">New Password</label>
                    <div className="relative">
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input w-full pr-10"
                            placeholder="Enter new password"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="mt-2">
                        <PasswordStrengthIndicator password={newPassword} />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input w-full pr-10"
                            placeholder="Confirm new password"
                            required
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                    >
                        {loading ? 'Changing...' : 'Change Password'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
