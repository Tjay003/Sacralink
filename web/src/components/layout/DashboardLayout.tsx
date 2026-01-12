import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Church,
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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Churches', href: '/churches', icon: Building2 },
    { name: 'Appointments', href: '/appointments', icon: Calendar },
    { name: 'Donations', href: '/donations', icon: Heart },
    { name: 'Announcements', href: '/announcements', icon: Megaphone },
];

export default function DashboardLayout() {
    const navigate = useNavigate();
    const { profile, signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const NavItem = ({ item }: { item: typeof navigation[0] }) => (
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
            {item.name}
        </NavLink>
    );

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
                className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Logo */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white">
                            <Church className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-foreground">SacraLink</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-secondary-500 hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {navigation.map((item) => (
                        <NavItem key={item.name} item={item} />
                    ))}
                </nav>

                {/* Bottom Section */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                    <NavLink
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                        Settings
                    </NavLink>
                </div>
            </aside>

            {/* Main Content */}
            <div className="lg:pl-64">
                {/* Header */}
                <header className="sticky top-0 z-30 h-16 bg-white border-b border-border">
                    <div className="flex items-center justify-between h-full px-4 lg:px-8">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-secondary-500 hover:text-foreground"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Page Title - Can be dynamic */}
                        <div className="hidden lg:block">
                            <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
                        </div>

                        {/* Right Section */}
                        <div className="flex items-center gap-4">
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
                                                onClick={handleSignOut}
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
        </div>
    );
}
