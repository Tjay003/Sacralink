import { Link } from 'react-router-dom';

interface AuthTabsProps {
    activeTab: 'login' | 'register';
}

export default function AuthTabs({ activeTab }: AuthTabsProps) {
    return (
        <div className="relative bg-gray-200 p-2 rounded-full w-full max-w-sm mx-auto flex isolate">
            {/* Sliding Background Pill */}
            <div
                className="absolute top-2 bottom-2 w-[calc(50%-8px)] bg-white rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                style={{
                    left: activeTab === 'login' ? '8px' : '50%'
                }}
            />

            {/* Login Link */}
            <Link
                to="/login"
                className={`relative z-10 flex-1 py-2.5 text-center text-sm font-medium transition-colors duration-300 ${activeTab === 'login' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
            >
                Login
            </Link>

            {/* Register Link */}
            <Link
                to="/register"
                className={`relative z-10 flex-1 py-2.5 text-center text-sm font-medium transition-colors duration-300 ${activeTab === 'register' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
            >
                Register
            </Link>
        </div>
    );
}
