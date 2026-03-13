import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isFeatureEnabled } from '../../config/featureFlags';

export default function SocialAuthButtons() {
    const { signInWithGoogle, signInWithFacebook } = useAuth();
    const [isLoading, setIsLoading] = useState<'google' | 'facebook' | null>(null);

    // Hide social auth when feature flag is disabled (e.g., in demo mode)
    if (!isFeatureEnabled('socialAuth')) {
        return null;
    }

    const handleGoogleLogin = async () => {
        try {
            setIsLoading('google');
            await signInWithGoogle();
        } catch (error) {
            console.error('Google login failed:', error);
            setIsLoading(null);
        }
    };

    const handleFacebookLogin = async () => {
        try {
            setIsLoading('facebook');
            await signInWithFacebook();
        } catch (error) {
            console.error('Facebook login failed:', error);
            setIsLoading(null);
        }
    };

    return (
        <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading !== null}
                    onClick={handleGoogleLogin}
                    className="w-full h-11 sm:h-12 bg-white hover:bg-gray-50 text-gray-700 border-gray-200 transition-all duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                    {isLoading === 'google' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                    )}
                    Google
                </Button>
                <Button
                    variant="outline"
                    type="button"
                    disabled={isLoading !== null}
                    onClick={handleFacebookLogin}
                    className="w-full h-11 sm:h-12 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white border-transparent transition-all duration-200 ease-in-out hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                    {isLoading === 'facebook' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                    ) : (
                        <svg className="mr-2 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                    )}
                    Facebook
                </Button>
            </div>
        </div>
    );
}
