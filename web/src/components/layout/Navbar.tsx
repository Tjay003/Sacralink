import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Building2,
    Calendar,
    Heart,
    MessageSquare,
    Users,
    ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';

/**
 * Navbar - Top navigation component for SacraLink
 */
export default function Navbar() {
    const { user, profile } = useAuth();

    if (!user) return null;

    const isSuperAdmin = profile?.role === 'super_admin';
    const isAdmin = profile?.role === 'admin' || isSuperAdmin;
    const isStaff = ['admin', 'super_admin', 'church_admin', 'volunteer', 'priest'].includes(
        profile?.role || ''
    );

    return (
        <nav className="sticky top-0 z-30 bg-white dark:bg-card border-b border-border shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand */}
                    <div className="flex items-center gap-6">
                        <NavLink to="/dashboard" className="flex items-center gap-2">
                            <span className="text-lg font-black tracking-tight text-primary">SACRA</span>
                            <span className="text-lg font-black tracking-tight text-foreground">LINK</span>
                        </NavLink>

                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center gap-1">
                            <NavLink
                                to="/dashboard"
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                    }`
                                }
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </NavLink>

                            {isAdmin && (
                                <NavLink
                                    to="/users"
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                            isActive
                                                ? 'bg-primary text-white'
                                                : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                        }`
                                    }
                                >
                                    <Users className="w-4 h-4" />
                                    Users
                                </NavLink>
                            )}

                            <NavLink
                                to="/churches"
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                    }`
                                }
                            >
                                <Building2 className="w-4 h-4" />
                                Churches
                            </NavLink>

                            {isSuperAdmin && (
                                <NavLink
                                    to="/admin/applications"
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                            isActive
                                                ? 'bg-primary text-white'
                                                : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                        }`
                                    }
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Parish Applications
                                </NavLink>
                            )}

                            <NavLink
                                to="/appointments"
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                    }`
                                }
                            >
                                <Calendar className="w-4 h-4" />
                                Appointments
                            </NavLink>

                            {/* Messages link (Ticket 05) */}
                            <NavLink
                                to="/messages"
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-primary text-white'
                                            : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                    }`
                                }
                            >
                                <MessageSquare className="w-4 h-4" />
                                Messages
                            </NavLink>

                            {isStaff && (
                                <NavLink
                                    to="/donations"
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                            isActive
                                                ? 'bg-primary text-white'
                                                : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300'
                                        }`
                                    }
                                >
                                    <Heart className="w-4 h-4" />
                                    Donations
                                </NavLink>
                            )}
                        </div>
                    </div>

                    {/* Right utilities */}
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                    </div>
                </div>
            </div>
        </nav>
    );
}
