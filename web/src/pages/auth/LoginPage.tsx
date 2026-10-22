import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import { BLOCKED_ACCOUNT_NOTICE_KEY } from '../../lib/blockedAccountNotice';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthTabs from '../../components/auth/AuthTabs';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SocialAuthButtons from '../../components/auth/SocialAuthButtons';

import { Card, CardContent } from "@/components/ui/card"
import logo from '../../assets/logo.png';
import {
    checkLoginRateLimit,
    recordFailedLogin,
    recordSuccessfulLogin,
} from '../../lib/authRateLimiter';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

    // A deleted account that was signed out of an open tab sees why
    useEffect(() => {
        try {
            const notice = window.sessionStorage.getItem(BLOCKED_ACCOUNT_NOTICE_KEY);
            if (notice) {
                window.sessionStorage.removeItem(BLOCKED_ACCOUNT_NOTICE_KEY);
                setError(notice);
            }
        } catch {
            // sessionStorage can be unavailable
        }
    }, []);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const watchedEmail = watch('email');

    // Check rate limit status whenever email changes
    useEffect(() => {
        if (!watchedEmail) {
            setLockoutSeconds(0);
            return;
        }
        const check = checkLoginRateLimit(watchedEmail);
        if (check.isLocked) {
            setLockoutSeconds(check.remainingSeconds);
            setError(`Security lock: Too many failed login attempts. Please wait ${check.remainingSeconds}s before trying again.`);
        } else {
            setLockoutSeconds(0);
        }
    }, [watchedEmail]);

    // Active countdown timer
    useEffect(() => {
        if (lockoutSeconds <= 0) return;

        const interval = setInterval(() => {
            setLockoutSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setError(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [lockoutSeconds]);

    const onSubmit = async (data: LoginFormData) => {
        try {
            setError(null);
            const check = checkLoginRateLimit(data.email);
            if (check.isLocked) {
                setLockoutSeconds(check.remainingSeconds);
                setError(`Security lock: Too many failed login attempts. Please wait ${check.remainingSeconds}s before trying again.`);
                return;
            }

            await signIn(data.email, data.password);
            recordSuccessfulLogin(data.email);
            navigate('/dashboard');
        } catch {
            const result = recordFailedLogin(data.email);
            if (result.isLocked) {
                setLockoutSeconds(result.remainingSeconds);
                setError(`Security lock: Account access temporarily suspended due to ${result.attempts} failed login attempts. Please wait ${result.remainingSeconds}s.`);
            } else {
                const remainingTries = 5 - result.attempts;
                if (remainingTries <= 2 && remainingTries > 0) {
                    setError(`Invalid email or password. Warning: ${remainingTries} attempt${remainingTries === 1 ? '' : 's'} remaining before temporary security lock.`);
                } else {
                    setError('Invalid email or password');
                }
            }
        }
    };

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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome Back</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Please enter your details to continue</p>
                </div>

                <div className="mb-4 sm:mb-6">
                    <AuthTabs activeTab="login" />
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

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                            <div className="space-y-2">
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter email or user name"
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
                                        {...register('password')}
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
                            </div>

                            <div className="flex items-center justify-end">
                                <Link
                                    to="/forgot-password"
                                    className="text-sm font-medium text-foreground hover:underline transition-colors"
                                >
                                    Forgot password ?
                                </Link>
                            </div>

                            {lockoutSeconds > 0 && (
                                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                        Account temporarily locked: Please wait <strong>{lockoutSeconds}s</strong> before attempting to log in again.
                                    </span>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full rounded-lg h-12 sm:h-14 text-base shadow-md transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] bg-primary hover:bg-primary/90 text-white cursor-pointer disabled:cursor-not-allowed"
                                disabled={isSubmitting || lockoutSeconds > 0}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Wait...
                                    </>
                                ) : lockoutSeconds > 0 ? (
                                    `Locked (${lockoutSeconds}s)`
                                ) : (
                                    'Login'
                                )}
                            </Button>
                        </form>

                        <SocialAuthButtons />
                    </CardContent>
                </Card>
            </motion.div>
        </AuthLayout>
    );
}
