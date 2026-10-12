import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Check, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthTabs from '../../components/auth/AuthTabs';
import PasswordStrengthIndicator from '../../components/auth/PasswordStrengthIndicator';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';

import { Card, CardContent } from "@/components/ui/card"
import logo from '../../assets/logo.png';
import PuzzleCaptchaModal from '../../components/common/PuzzleCaptchaModal';
import { isDemoMode } from '../../config/featureFlags';
import {
    checkRegistrationRateLimit,
    recordRegistrationAttempt,
} from '../../lib/authRateLimiter';

const registerSchema = z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^a-zA-Z0-9\s]/, 'Password must contain at least one special character'),
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
    const [isPuzzleOpen, setIsPuzzleOpen] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<RegisterFormData | null>(null);
    const [isExecutingRegistration, setIsExecutingRegistration] = useState(false);

    // Rate Limiting state
    const [rateLimitState, setRateLimitState] = useState<{
        isLocked: boolean;
        remainingSeconds: number;
    }>({ isLocked: false, remainingSeconds: 0 });

    useEffect(() => {
        const check = checkRegistrationRateLimit();
        setRateLimitState({ isLocked: check.isLocked, remainingSeconds: check.remainingSeconds });

        if (check.isLocked && check.remainingSeconds > 0) {
            const timer = setInterval(() => {
                setRateLimitState((prev) => {
                    if (prev.remainingSeconds <= 1) {
                        clearInterval(timer);
                        return { isLocked: false, remainingSeconds: 0 };
                    }
                    return { isLocked: true, remainingSeconds: prev.remainingSeconds - 1 };
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        setError(null);

        // Check registration rate limits
        const rateCheck = checkRegistrationRateLimit();
        if (rateCheck.isLocked) {
            setError(`Security lock: Too many account registration attempts. Please wait ${rateCheck.remainingSeconds}s before trying again.`);
            setRateLimitState({ isLocked: true, remainingSeconds: rateCheck.remainingSeconds });
            return;
        }

        if (isDemoMode) {
            // In demo mode, proceed directly
            executeSignUp(data, 'demo-verified-token');
            return;
        }

        // Open Interactive Puzzle CAPTCHA
        setPendingFormData(data);
        setIsPuzzleOpen(true);
    };

    const executeSignUp = async (data: RegisterFormData, captchaToken: string) => {
        try {
            setIsExecutingRegistration(true);
            setError(null);
            recordRegistrationAttempt();
            await signUp(data.email, data.password, data.fullName, captchaToken);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create account');
        } finally {
            setIsExecutingRegistration(false);
        }
    };

    const handlePuzzleSuccess = (token: string) => {
        if (pendingFormData) {
            executeSignUp(pendingFormData, token);
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
        <AuthLayout>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full"
            >
                <div className="flex flex-col items-center mb-4 sm:mb-6 space-y-2">
                    <img src={logo} alt="SacraLink Logo" className="w-12 h-12 sm:w-16 sm:h-16 mb-1 sm:mb-2" />
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        <span className="text-primary">SACRA</span>
                        <span className="text-foreground">LINK</span>
                    </div>
                </div>

                <div className="text-center mb-4 sm:mb-6 space-y-1 sm:space-y-2 min-h-[64px] flex flex-col justify-center">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Account</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Join SacraLink to manage your parish</p>
                </div>

                <div className="mb-4 sm:mb-6">
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

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
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

                            {rateLimitState.isLocked && (
                                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                        Security rate limit active: Too many recent registration requests. Please wait <strong>{rateLimitState.remainingSeconds}s</strong> before trying again.
                                    </span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full rounded-lg h-11 sm:h-12 text-base font-semibold shadow-md transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] mt-2 sm:mt-4 text-white cursor-pointer"
                                disabled={isSubmitting || isExecutingRegistration || rateLimitState.isLocked}
                            >
                                {isSubmitting || isExecutingRegistration ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>

                        {/* Interactive Puzzle CAPTCHA Modal */}
                        <PuzzleCaptchaModal
                            isOpen={isPuzzleOpen}
                            onClose={() => setIsPuzzleOpen(false)}
                            onSuccess={handlePuzzleSuccess}
                        />

                        <SocialAuthButtons />
                    </CardContent>
                </Card>
            </motion.div>
        </AuthLayout>
    );
}
