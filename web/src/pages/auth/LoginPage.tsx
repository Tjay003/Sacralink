import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthTabs from '../../components/auth/AuthTabs';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Card, CardContent } from "@/components/ui/card"
import logo from '../../assets/logo.png';

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
            setError('Invalid email or password');
        }
    };

    return (
        <AuthLayout
            rightContent={
                <div className="text-sm">
                    <span className="text-muted-foreground">Don't have an account? </span>
                    <Link to="/register" className="font-semibold text-primary hover:text-primary-600 transition-colors">
                        Register
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
                    <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
                    <p className="text-muted-foreground">Welcome Back, Please Enter your details</p>
                </div>

                <div className="mb-6">
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

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

                            <Button
                                type="submit"
                                className="w-full rounded-lg h-14 text-base shadow-md active:scale-[0.98] transition-all bg-primary hover:bg-primary/90 text-white"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Wait...
                                    </>
                                ) : (
                                    'Login'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </AuthLayout>
    );
}
