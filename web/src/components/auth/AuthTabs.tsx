import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface AuthTabsProps {
    activeTab: 'login' | 'register';
}

export default function AuthTabs({ activeTab }: AuthTabsProps) {
    const tabs = [
        { id: 'login', label: 'Login', path: '/login' },
        { id: 'register', label: 'Register', path: '/register' },
    ] as const;

    return (
        <div className="relative bg-gray-100/90 dark:bg-muted/40 p-1.5 rounded-full w-full max-w-sm mx-auto flex items-center border border-gray-200/70 dark:border-border/40 shadow-inner backdrop-blur-sm">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <Link
                        key={tab.id}
                        to={tab.path}
                        className={`relative flex-1 py-2 text-center text-sm font-semibold rounded-full transition-colors duration-200 select-none z-10 ${
                            isActive
                                ? 'text-foreground font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeAuthTabPill"
                                transition={{
                                    type: 'spring',
                                    stiffness: 450,
                                    damping: 35,
                                    mass: 0.8,
                                }}
                                className="absolute inset-0 bg-background rounded-full shadow-md border border-border/40 -z-10"
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}

