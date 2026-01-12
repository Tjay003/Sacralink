import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Church, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setError(null);
            await signIn(data.email, data.password);
            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-background to-accent-50 px-4">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg shadow-primary/30">
                        <Church className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground">SacraLink</h1>
                    <p className="text-muted mt-2">Admin Dashboard</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-secondary-200/50 p-8">
                    <h2 className="text-xl font-semibold text-center mb-6">Welcome back</h2>

                    {error && (
                        <div className="alert-error mb-6">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="label block mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                className={`input ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                placeholder="admin@parish.com"
                                {...register('email')}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="label block mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={`input pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    placeholder="••••••••"
                                    {...register('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Forgot Password */}
                        <div className="text-right">
                            <Link
                                to="/forgot-password"
                                className="text-sm text-primary hover:text-primary-700 transition-colors"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary w-full h-11"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <p className="text-center text-sm text-muted mt-6">
                        Don't have an account?{' '}
                        <Link
                            to="/register"
                            className="text-primary hover:text-primary-700 font-medium transition-colors"
                        >
                            Request access
                        </Link>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-muted mt-8">
                    © 2026 SacraLink. All rights reserved.
                </p>
            </div>
        </div>
    );
}
