import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Building2,
    Calendar,
    Heart,
    Megaphone,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronDown,
    User,
    Users,
    Search,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import { featureFlags, isDemoMode } from '../../config/featureFlags';
import logo from '../../assets/logo.png';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users, adminOnly: true, featureKey: 'admin' as const },
    { name: 'Churches', href: '/churches', icon: Building2, featureKey: 'churches' as const },
    { name: 'Appointments', href: '/appointments', icon: Calendar, featureKey: 'appointments' as const },
    { name: 'Donations', href: '/donations', icon: Heart, featureKey: 'donations' as const, staffOnly: true },
    { name: 'System Announcements', href: '/admin/system-announcements', icon: Megaphone, superAdminOnly: true, featureKey: 'systemAnnouncements' as const },
];

export default function DashboardLayout() {
    const navigate = useNavigate();
    const { profile, signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleSignOutClick = () => {
        setShowLogoutModal(true);
        setUserMenuOpen(false);
    };

    const handleConfirmSignOut = async () => {
        setShowLogoutModal(false);
        await signOut();
        navigate('/login');
    };

    const NavItem = ({ item, disabled }: { item: typeof navigation[0]; disabled?: boolean }) => {
        if (disabled) {
            // Render as disabled button (not clickable)
            return (
                <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium 
                               text-secondary-300 cursor-not-allowed opacity-50"
                    title="This feature is not available in demo mode"
                >
                    <item.icon className="w-5 h-5" />
                    {!sidebarCollapsed && item.name}
                </div>
            );
        }

        // Render as normal NavLink
        return (
            <NavLink
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                        ? 'bg-primary text-white'
                        : 'text-secondary-600 hover:bg-secondary-100'
                    }`
                }
            >
                <item.icon className="w-5 h-5" />
                {!sidebarCollapsed && item.name}
            </NavLink>
        );
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-border transform transition-all duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
            >
                {/* Logo */}
                <div className="flex items-center justify-center h-16 px-4 relative">
                    {!sidebarCollapsed ? (
                        <div className="flex items-center gap-3">
                            <img src={logo} alt="SacraLink Logo" className="w-10 h-10" />
                            <div className="text-lg font-extrabold tracking-tight">
                                <span className="text-primary">SACRA</span>
                                <span className="text-foreground">LINK</span>
                            </div>
                        </div>
                    ) : (
                        <img src={logo} alt="SacraLink Logo" className="w-10 h-10" />
                    )}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden absolute right-4 p-2 text-secondary-500 hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {navigation.map((item) => {
                        // Check if user has permission for super-admin-only items (admin, super_admin)
                        if ((item as any).superAdminOnly && !['admin', 'super_admin'].includes(profile?.role || '')) {
                            return null; // Hide super-admin-only items from unauthorized users
                        }

                        // Check if user has permission for admin-only items (admin, super_admin, church_admin)
                        if (item.adminOnly && !['admin', 'super_admin', 'church_admin'].includes(profile?.role || '')) {
                            return null; // Hide admin-only items from unauthorized users
                        }

                        // Hide staff-only items from regular users (they use Profile page for their donation history)
                        if ((item as any).staffOnly && ['user'].includes(profile?.role || '')) {
                            return null;
                        }

                        // Check if item should be disabled (feature flag only)
                        const isDisabled = item.featureKey && !featureFlags[item.featureKey].enabled;

                        // Special case: System Announcements should be disabled in demo mode
                        // even though the feature flag is enabled (we want to show it but not make it clickable)
                        const isSystemAnnouncementsInDemoMode =
                            item.name === 'System Announcements' && isDemoMode;

                        return (
                            <NavItem
                                key={item.name}
                                item={item}
                                disabled={isDisabled || isSystemAnnouncementsInDemoMode}
                            />
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                    <NavLink
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                        {!sidebarCollapsed && 'Settings'}
                    </NavLink>
                </div>
            </aside>

            {/* Main Content */}
            <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
                {/* Header */}
                <header className="sticky top-0 z-30 h-16 bg-white border-b border-border">
                    <div className="relative flex items-center justify-between h-full px-4 lg:px-8">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden absolute left-4 p-2 text-secondary-500 hover:text-foreground"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Desktop Sidebar Collapse Button */}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="hidden lg:block absolute left-4 p-2 text-secondary-500 hover:text-foreground"
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Search Bar */}
                        <div className="flex-1 max-w-md hidden lg:block ml-12">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search anything..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center gap-4">
                            {/* Notification Bell */}
                            <NotificationBell />

                            {/* User Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50 transition-colors"
                                >
                                    <div className="avatar bg-primary-100">
                                        {profile?.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                alt={profile.full_name || ''}
                                                className="avatar-image"
                                            />
                                        ) : (
                                            <div className="avatar-fallback bg-primary-100 text-primary">
                                                <User className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="hidden md:block text-left">
                                        <p className="text-sm font-medium text-foreground">
                                            {profile?.full_name || 'User'}
                                        </p>
                                        <p className="text-xs text-muted capitalize">
                                            {profile?.role?.replace('_', ' ') || 'Admin'}
                                        </p>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-muted" />
                                </button>

                                {/* Dropdown */}
                                {userMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setUserMenuOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-border py-1 z-50">
                                            <NavLink
                                                to="/profile"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
                                            >
                                                <User className="w-4 h-4" />
                                                Profile
                                            </NavLink>
                                            <NavLink
                                                to="/settings"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
                                            >
                                                <Settings className="w-4 h-4" />
                                                Settings
                                            </NavLink>
                                            <hr className="my-1 border-border" />
                                            <button
                                                onClick={handleSignOutClick}
                                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-red-50"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sign out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                <LogOut className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Sign Out</h3>
                                <p className="text-sm text-muted">Are you sure you want to sign out?</p>
                            </div>
                        </div>

                        <p className="text-sm text-muted mb-6">
                            You'll need to sign in again to access your account.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="px-4 py-2 text-sm font-medium text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSignOut}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
