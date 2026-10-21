import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LinkIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logo from '../../assets/logo.png';

const MIN_PASSWORD_LENGTH = 8;

const resetPasswordSchema = z
    .object({
        password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
        confirmPassword: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((values) => values.password === values.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Reached from the link in the reset email. Opening that link signs the user in with a recovery session
 * (supabase-js raises PASSWORD_RECOVERY and AuthContext picks the session up), so the form is only usable
 * while a session exists; without one the link was missing, expired or already used.
 */
export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const { session } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
    });

    // Ends the recovery session (which also swaps the router to its signed-out routes) so the user signs in with the new password.
    const goToLogin = async () => {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
    };

    const onSubmit = async (data: ResetPasswordFormData) => {
        try {
            setError(null);
            const { error: updateError } = await supabase.auth.updateUser({ password: data.password });
            if (updateError) throw updateError;
            setDone(true);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'We could not update your password. Please request a new reset link.');
        }
    };

    const header = (
        <div className="flex flex-col items-center mb-4 sm:mb-6 space-y-2">
            <img src={logo} alt="SacraLink Logo" className="w-12 h-12 sm:w-16 sm:h-16 mb-1 sm:mb-2" />
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                <span className="text-primary">SACRA</span>
                <span className="text-foreground">LINK</span>
            </div>
        </div>
    );

    if (done) {
        return (
            <AuthLayout>
                <div className="w-full">
                    {header}
                    <div className="text-center space-y-4" data-testid="reset-password-done">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Password updated</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            Your password has been changed. Sign in with your new password to continue.
                        </p>
                        <Button
                            type="button"
                            className="w-full rounded-lg h-12 sm:h-14 text-base shadow-md bg-primary hover:bg-primary/90 text-white cursor-pointer"
                            onClick={goToLogin}
                        >
                            Go to login
                        </Button>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    if (!session) {
        return (
            <AuthLayout>
                <div className="w-full">
                    {header}
                    <div className="text-center space-y-4" data-testid="reset-password-no-session">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                            <LinkIcon className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reset link not valid</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            This password reset link is invalid, has expired or was already used. Request a new one to continue.
                        </p>
                        <Link
                            to="/forgot-password"
                            className="inline-flex w-full items-center justify-center rounded-lg h-12 sm:h-14 text-base font-medium shadow-md bg-primary hover:bg-primary/90 text-white"
                        >
                            Request a new link
                        </Link>
                        <div>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to login
                            </Link>
                        </div>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full"
            >
                {header}

                <div className="text-center mb-4 sm:mb-6 space-y-1 sm:space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Set a new password</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Choose a password of at least {MIN_PASSWORD_LENGTH} characters.
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"
                    >
                        <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6" noValidate>
                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder="New password"
                                className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                {...register('password')}
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-xs text-destructive">{errors.password.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showConfirm ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder="Confirm new password"
                                className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 pr-10 ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                {...register('confirmPassword')}
                            />
                            <button
                                type="button"
                                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full rounded-lg h-12 sm:h-14 text-base shadow-md transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] bg-primary hover:bg-primary/90 text-white cursor-pointer disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Update password'
                        )}
                    </Button>
                </form>
            </motion.div>
        </AuthLayout>
    );
}
