import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthTabs from '../../components/auth/AuthTabs';
import PasswordStrengthIndicator from '../../components/auth/PasswordStrengthIndicator';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Card, CardContent } from "@/components/ui/card"
import logo from '../../assets/logo.png';

const registerSchema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const { signUp } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [password, setPassword] = useState(''); // For strength indicator

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
            <AuthLayout>
                <div className="text-center space-y-6 animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">Account Created!</h2>
                        <p className="text-muted-foreground text-lg">
                            Please check your email to verify your account before logging in.
                        </p>
                    </div>
                    <Link to="/login">
                        <Button className="w-full rounded-full h-12 text-base shadow-md">
                            Back to Login
                        </Button>
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            rightContent={
                <div className="text-sm">
                    <span className="text-muted-foreground">Already have an account? </span>
                    <Link to="/login" className="font-semibold text-primary hover:text-primary-600 transition-colors">
                        Login
                    </Link>
                </div>
            }
        >
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full"
            >
                <div className="flex flex-col items-center mb-6 space-y-2">
                    <img src={logo} alt="SacraLink Logo" className="w-16 h-16 mb-2" />
                    <div className="text-3xl font-extrabold tracking-tight">
                        <span className="text-primary">SACRA</span>
                        <span className="text-foreground">LINK</span>
                    </div>
                </div>

                <div className="text-center mb-6 space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
                    <p className="text-muted-foreground">Join SacraLink to manage your parish.</p>
                </div>

                <div className="mb-6">
                    <AuthTabs activeTab="register" />
                </div>

                <Card className="border-none shadow-none bg-transparent p-0">
                    <CardContent className="p-0">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"
                            >
                                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                {error}
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="Full Name"
                                    className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 ${errors.fullName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    {...register('fullName')}
                                />
                                {errors.fullName && (
                                    <p className="text-xs text-destructive">{errors.fullName.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Email Address"
                                    className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p className="text-xs text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                        {...register('password', {
                                            onChange: (e) => setPassword(e.target.value)
                                        })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-xs text-destructive">{errors.password.message}</p>
                                )}
                                <PasswordStrengthIndicator password={password} />
                            </div>

                            <div className="space-y-2">
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm Password"
                                    className={`rounded-lg bg-gray-50 border-transparent focus:border-primary px-3 h-10 ${errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    {...register('confirmPassword')}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-lg h-12 text-base font-semibold shadow-md active:scale-[0.98] transition-all mt-4 text-white"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </AuthLayout>
    );
}
