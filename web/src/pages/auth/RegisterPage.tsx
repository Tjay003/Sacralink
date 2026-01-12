import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Church, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const registerSchema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const navigate = useNavigate();
    const { signUp } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setError(null);
            await signUp(data.email, data.password, data.fullName);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-background to-accent-50 px-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl shadow-secondary-200/50 p-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 text-success mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Account Created!</h2>
                        <p className="text-muted mb-6">
                            Please check your email to verify your account. An administrator will review your access request.
                        </p>
                        <Link to="/login" className="btn-primary">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-background to-accent-50 px-4 py-8">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg shadow-primary/30">
                        <Church className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground">SacraLink</h1>
                    <p className="text-muted mt-2">Request Admin Access</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-secondary-200/50 p-8">
                    <h2 className="text-xl font-semibold text-center mb-6">Create Account</h2>

                    {error && (
                        <div className="alert-error mb-6">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Full Name */}
                        <div>
                            <label htmlFor="fullName" className="label block mb-2">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                className={`input ${errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                placeholder="Juan Dela Cruz"
                                {...register('fullName')}
                            />
                            {errors.fullName && (
                                <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="label block mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                className={`input ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                placeholder="your.email@parish.com"
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

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="label block mb-2">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                className={`input ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                placeholder="••••••••"
                                {...register('confirmPassword')}
                            />
                            {errors.confirmPassword && (
                                <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>
                            )}
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
                                    Creating account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-muted mt-6">
                        Already have an account?{' '}
                        <Link
                            to="/login"
                            className="text-primary hover:text-primary-700 font-medium transition-colors"
                        >
                            Sign in
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
