import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Church,
    ShieldCheck,
    Users,
    Calendar,
    MessageSquare,
    Megaphone,
    Heart,
    LogOut,
    Menu,
    X,
    ChevronDown,
    User,
    Search,
    Type,
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import ConfirmationModal from '../modals/ConfirmationModal';
import { featureFlags } from '../../config/featureFlags';
import { supabase } from '../../lib/supabase';
import logo from '../../assets/logo.png';

interface NavigationItem {
    name: string;
    href: string;
    icon: LucideIcon;
    badge?: number | string;
    featureKey?: keyof typeof featureFlags;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
    staffOnly?: boolean;
    churchAdminOnly?: boolean;
}

interface NavSection {
    title: string;
    items: NavigationItem[];
}

export default function DashboardLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile, signOut } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [largeTextMode, setLargeTextMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingDonationsCount, setPendingDonationsCount] = useState<number>(0);

    const isChurchAdmin = profile?.role === 'church_admin';
    const churchId = profile?.assigned_church_id || profile?.church_id;

    useEffect(() => {
        if (!isChurchAdmin || !churchId) {
            setPendingDonationsCount(0);
            return;
        }

        const fetchPendingDonations = async () => {
            try {
                const { count, error } = await supabase
                    .from('donations')
                    .select('*', { count: 'exact', head: true })
                    .eq('church_id', churchId)
                    .eq('status', 'pending');

                if (!error && count !== null) {
                    setPendingDonationsCount(count);
                }
            } catch (err) {
                console.error('Error fetching pending donations count:', err);
            }
        };

        void fetchPendingDonations();

        const channel = supabase
            .channel(`layout-donations-${churchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'donations', filter: `church_id=eq.${churchId}` },
                () => {
                    void fetchPendingDonations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isChurchAdmin, churchId]);

    const handleSignOutClick = () => {
        setShowLogoutModal(true);
        setUserMenuOpen(false);
    };

    const handleConfirmSignOut = async () => {
        setShowLogoutModal(false);
        await signOut();
        navigate('/login');
    };

    // Navigation sections matching the redesigned mockup: OVERVIEW, DIOCESE, OPERATIONS
    const navSections: NavSection[] = [
        {
            title: 'OVERVIEW',
            items: [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            ],
        },
        {
            title: 'DIOCESE',
            items: [
                { name: 'Parishes', href: '/churches', icon: Church, featureKey: 'churches' },
                {
                    name: 'Parish applications',
                    href: '/admin/applications',
                    icon: ShieldCheck,
                    superAdminOnly: true,
                    badge: 2,
                },
                {
                    name: 'Users',
                    href: '/users',
                    icon: Users,
                    adminOnly: true,
                    featureKey: 'admin',
                },
            ],
        },
        {
            title: 'OPERATIONS',
            items: [
                {
                    name: 'Appointments',
                    href: '/appointments',
                    icon: Calendar,
                    featureKey: 'appointments',
                    badge: 12,
                },
                {
                    name: 'Donations',
                    href: '/donations',
                    icon: Heart,
                    featureKey: 'donations',
                    churchAdminOnly: true,
                    badge: pendingDonationsCount > 0 ? pendingDonationsCount : undefined,
                },
                {
                    name: 'Messages',
                    href: '/messages',
                    icon: MessageSquare,
                    featureKey: 'messages',
                    badge: 2,
                },
                {
                    name: 'System announcements',
                    href: '/admin/system-announcements',
                    icon: Megaphone,
                    superAdminOnly: true,
                    featureKey: 'systemAnnouncements',
                },
            ],
        },
    ];

    const canRenderItem = (item: NavigationItem) => {
        if (item.churchAdminOnly && profile?.role !== 'church_admin') {
            return false;
        }
        if (item.superAdminOnly && !['admin', 'super_admin'].includes(profile?.role || '')) {
            return false;
        }
        if (item.adminOnly && !['admin', 'super_admin', 'church_admin'].includes(profile?.role || '')) {
            return false;
        }
        if (item.staffOnly && ['user'].includes(profile?.role || '')) {
            return false;
        }
        return true;
    };

    const NavLinkItem = ({ item }: { item: NavigationItem }) => {
        const isDisabled = item.featureKey && !featureFlags[item.featureKey].enabled;

        if (isDisabled) {
            return (
                <div
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-secondary-300 cursor-not-allowed opacity-50"
                    title="Feature unavailable in demo mode"
                >
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                </div>
            );
        }

        return (
            <NavLink
                to={item.href}
                end={item.href === '/dashboard' || item.href === '/calendar'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                    `flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 group ${
                        isActive
                            ? 'bg-blue-50 text-primary font-semibold shadow-xs'
                            : 'text-secondary-600 hover:text-foreground hover:bg-secondary-50'
                    }`
                }
            >
                <div className="flex items-center gap-3 min-w-0">
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-105" />
                    {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                </div>

                {!sidebarCollapsed && item.badge !== undefined && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-primary text-white flex-shrink-0 shadow-xs">
                        {item.badge}
                    </span>
                )}
            </NavLink>
        );
    };

    return (
        <div className={`min-h-screen bg-background ${largeTextMode ? 'text-lg' : ''}`}>
            {/* Mobile Sidebar Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-border flex flex-col justify-between transform transition-all duration-200 ease-in-out ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
            >
                {/* Brand Header */}
                <div>
                    <div className="flex items-center justify-between h-20 px-5 border-b border-border/60">
                        {!sidebarCollapsed ? (
                            <div className="flex items-center gap-3">
                                <img
                                    src={logo}
                                    alt="SacraLink"
                                    className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
                                />
                                <div className="leading-tight">
                                    <div className="text-base font-extrabold tracking-tight">
                                        <span className="text-foreground">SACRA</span>
                                        <span className="text-primary">LINK</span>
                                    </div>
                                    <p className="text-[11px] text-muted font-medium truncate max-w-[130px]">
                                        Diocese of San Jose del Monte
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={logo}
                                alt="SacraLink"
                                className="w-10 h-10 mx-auto rounded-xl object-contain"
                            />
                        )}

                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-1.5 text-secondary-500 hover:text-foreground rounded-lg hover:bg-secondary-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Menu by Sections */}
                    <div className="p-3.5 space-y-5 overflow-y-auto max-h-[calc(100vh-230px)]">
                        {navSections.map((section) => {
                            const filteredItems = section.items.filter(canRenderItem);
                            if (filteredItems.length === 0) return null;

                            return (
                                <div key={section.title} className="space-y-1">
                                    {!sidebarCollapsed && (
                                        <h4 className="px-3.5 text-[10px] font-bold tracking-wider text-secondary-400 uppercase mb-1.5">
                                            {section.title}
                                        </h4>
                                    )}
                                    <div className="space-y-0.5">
                                        {filteredItems.map((item) => (
                                            <NavLinkItem key={item.name} item={item} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section (Accessibility Toggle, Diocese Badge, Sign Out) */}
                <div className="p-3.5 border-t border-border/80 bg-white space-y-2">
                    {/* Large Text Mode Toggle */}
                    {!sidebarCollapsed ? (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary-50/60 text-secondary-700 text-xs font-medium">
                            <div className="flex items-center gap-2">
                                <Type className="w-4 h-4 text-secondary-500" />
                                <span>Large text mode</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLargeTextMode(!largeTextMode)}
                                className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none ${
                                    largeTextMode ? 'bg-primary' : 'bg-secondary-200'
                                }`}
                                role="switch"
                                aria-checked={largeTextMode}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                        largeTextMode ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    ) : null}

                    {/* Diocese Summary Pill */}
                    {!sidebarCollapsed && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs">
                            <div className="flex items-center gap-2 font-semibold text-amber-950">
                                <Church className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                                <span className="truncate">CSJDM Diocese</span>
                            </div>
                            <p className="text-[11px] text-amber-800/90 mt-0.5 pl-5.5">
                                5 parishes · 29 members
                            </p>
                        </div>
                    )}

                    {/* Sign Out Button */}
                    <button
                        onClick={handleSignOutClick}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-destructive hover:bg-red-50 transition-colors w-full text-left"
                    >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        {!sidebarCollapsed && 'Sign out'}
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
                {/* Global Topbar */}
                <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-border">
                    <div className="flex items-center justify-between h-full px-4 lg:px-8 gap-4">
                        {/* Left: Mobile Toggle & Desktop Collapse */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 text-secondary-500 hover:text-foreground rounded-lg hover:bg-secondary-50"
                            >
                                <Menu className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="hidden lg:block p-2 text-secondary-500 hover:text-foreground rounded-lg hover:bg-secondary-50"
                                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Middle: Universal Search Bar with Ctrl+K */}
                        <div className="flex-1 max-w-xl">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search parishes, people, appointments..."
                                    className="w-full pl-10 pr-16 py-2 bg-secondary-50/70 border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-border text-[10px] font-medium text-muted shadow-2xs">
                                    <span>Ctrl</span>
                                    <span>K</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions & User Dropdown */}
                        <div className="flex items-center gap-3">
                            <NotificationBell />

                            {/* User Avatar & Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-secondary-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-blue-50">
                                        {profile?.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                alt={profile.full_name || ''}
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            <span>
                                                {profile?.full_name
                                                    ? profile.full_name
                                                          .split(' ')
                                                          .map((n) => n[0])
                                                          .join('')
                                                          .slice(0, 2)
                                                          .toUpperCase()
                                                    : 'DE'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="hidden sm:block text-left leading-tight">
                                        <p className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                                            {profile?.full_name?.split(' ')[0] || 'Denzel'}
                                        </p>
                                        <p className="text-[10px] text-muted capitalize">
                                            {profile?.role?.replace('_', ' ') || 'Super Admin'}
                                        </p>
                                    </div>
                                    <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                </button>

                                {/* Dropdown Menu */}
                                {userMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setUserMenuOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-border py-1.5 z-50">
                                            <NavLink
                                                to="/profile"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-secondary-700 hover:bg-secondary-50"
                                            >
                                                <User className="w-4 h-4" />
                                                Profile
                                            </NavLink>
                                            <hr className="my-1 border-border" />
                                            <button
                                                onClick={handleSignOutClick}
                                                className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-destructive hover:bg-red-50"
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

                {/* Page View */}
                <main className="p-4 lg:p-8">
                    <div key={location.pathname} className="animate-in">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Logout Modal */}
            <ConfirmationModal
                isOpen={showLogoutModal}
                title="Sign Out"
                message="Are you sure you want to sign out of the Diocese Portal?"
                confirmLabel="Sign Out"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleConfirmSignOut}
                onCancel={() => setShowLogoutModal(false)}
            />
        </div>
    );
}
