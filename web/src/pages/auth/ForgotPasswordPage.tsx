import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';

import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logo from '../../assets/logo.png';
import { resetPassword } from '../../lib/supabase';

const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            setError(null);
            await resetPassword(data.email);
            // Same confirmation whether or not the address is registered, so the form cannot be used to discover accounts.
            setSentTo(data.email);
        } catch {
            setError('We could not send the reset email right now. Please try again in a moment.');
        }
    };

    return (
        <AuthLayout>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full"
            >
                <div className="flex flex-col items-center mb-4 sm:mb-6 space-y-2">
                    <img src={logo} alt="SacraLink Logo" className="w-12 h-12 sm:w-16 sm:h-16 mb-1 sm:mb-2" />
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        <span className="text-primary">SACRA</span>
                        <span className="text-foreground">LINK</span>
                    </div>
                </div>

                {sentTo ? (
                    <div className="text-center space-y-4" data-testid="forgot-password-sent">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <MailCheck className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Check your email</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            If an account exists for <strong className="text-foreground">{sentTo}</strong>, we have sent a link to reset your password.
                            The link opens a page where you can choose a new one.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to login
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-4 sm:mb-6 space-y-1 sm:space-y-2">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Forgot password?</h1>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                Enter the email you registered with and we will send you a reset link.
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
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="Enter your email"
                                    className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p className="text-xs text-destructive">{errors.email.message}</p>
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
                                        Sending...
                                    </>
                                ) : (
                                    'Send reset link'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to login
                            </Link>
                        </div>
                    </>
                )}
            </motion.div>
        </AuthLayout>
    );
}
