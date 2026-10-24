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
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';
import ConfirmationModal from '../modals/ConfirmationModal';
import { featureFlags } from '../../config/featureFlags';
import { supabase } from '../../lib/supabase';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import logo from '../../assets/logo.png';
import ParishAssistant from '../ai/ParishAssistant';

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
    hiddenForSuperAdmin?: boolean;
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
    const [pendingDonationsCount, setPendingDonationsCount] = useState<number>(0);
    const sidebarCounts = useSidebarCounts(profile);
    const [dioceseSummary, setDioceseSummary] = useState<{ parishes: number; members: number } | null>(null);

    useEffect(() => {
        if (!profile?.id) return;
        let cancelled = false;
        const fetchDioceseSummary = async () => {
            try {
                const [parishesRes, membersRes] = await Promise.all([
                    supabase.from('churches').select('*', { count: 'exact', head: true }).eq('is_active', true),
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                ]);
                if (cancelled || parishesRes.error || membersRes.error) return;
                setDioceseSummary({ parishes: parishesRes.count ?? 0, members: membersRes.count ?? 0 });
            } catch (err) {
                console.error('Error fetching diocese summary:', err);
            }
        };
        void fetchDioceseSummary();
        return () => {
            cancelled = true;
        };
    }, [profile?.id]);

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

    // Navigation sections matching the redesigned mockup: OVERVIEW, MANAGEMENT, OPERATIONS
    const navSections: NavSection[] = [
        {
            title: 'OVERVIEW',
            items: [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            ],
        },
        {
            title: 'MANAGEMENT',
            items: [
                { name: 'Churches', href: '/churches', icon: Church, featureKey: 'churches' },
                {
                    name: 'Church Applications',
                    href: '/admin/applications',
                    icon: ShieldCheck,
                    superAdminOnly: true,
                    badge: sidebarCounts.pendingApplications > 0 ? sidebarCounts.pendingApplications : undefined,
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
                    // Hidden for the admins for now (client request)
                    hiddenForSuperAdmin: true,
                    badge: sidebarCounts.pendingAppointments > 0 ? sidebarCounts.pendingAppointments : undefined,
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
                    badge: sidebarCounts.unreadMessages > 0 ? sidebarCounts.unreadMessages : undefined,
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
        if (item.hiddenForSuperAdmin && profile?.role === 'super_admin') {
            return false;
        }
        if (item.churchAdminOnly && profile?.role !== 'church_admin') {
            return false;
        }
        if (item.superAdminOnly && profile?.role !== 'super_admin') {
            return false;
        }
        if (item.adminOnly && !['super_admin', 'church_admin'].includes(profile?.role || '')) {
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
        <div className="min-h-screen bg-background">
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
                                        Parishes of San Jose del Monte
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

                {/* Bottom Section (Churches Badge, Sign Out) */}
                <div className="p-3.5 border-t border-border/80 bg-white space-y-2">
                    {/* Churches Summary Pill */}
                    {!sidebarCollapsed && dioceseSummary && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs">
                            <div className="flex items-center gap-2 font-semibold text-amber-950">
                                <Church className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                                <span className="truncate">San Jose del Monte</span>
                            </div>
                            <p className="text-[11px] text-amber-800/90 mt-0.5 pl-5.5">
                                {dioceseSummary.parishes} {dioceseSummary.parishes === 1 ? 'church' : 'churches'} · {dioceseSummary.members} {dioceseSummary.members === 1 ? 'member' : 'members'}
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

                        {/* Universal search bar is hidden for now (client request); this spacer keeps the actions right-aligned */}
                        <div className="flex-1" />

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
                message="Are you sure you want to sign out of Sacralink?"
                confirmLabel="Sign Out"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={handleConfirmSignOut}
                onCancel={() => setShowLogoutModal(false)}
            />
            {/* Global AI Parish Assistant (for Parishioners only) */}
            <ParishAssistant />
        </div>
    );
}
