import type { ReactNode } from 'react';
import AuthCarousel from './AuthCarousel';
import logo from '../../assets/logo.png';

interface AuthLayoutProps {
    children: ReactNode;
    rightContent?: ReactNode; // Optional extra content like "Don't have an account?" link
}

export default function AuthLayout({ children, rightContent }: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex w-full bg-background overflow-hidden">
            {/* Left Side - Carousel (Hidden on mobile) */}
            <div className="hidden lg:block lg:w-1/2 relative bg-primary-900 m-4 rounded-3xl overflow-hidden shadow-2xl">
                <AuthCarousel />
                {/* Logo Overlay at Bottom Left */}
                <div className="absolute bottom-10 left-10 z-20 flex items-center gap-3">
                    <img src={logo} alt="SacraLink Logo" className="w-12 h-12" />
                    <div className="text-3xl font-extrabold tracking-tight">
                        <span className="text-blue-400">SACRA</span>
                        <span className="text-white">LINK</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative">


                <div className="w-full max-w-[440px] space-y-8">
                    {children}
                </div>

                {/* Bottom Link (if provided) */}
                {rightContent && (
                    <div className="absolute top-8 right-8 hidden md:block">
                        {rightContent}
                    </div>
                )}
            </div>
        </div>
    );
}
