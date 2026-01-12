import {
    Building2,
    Calendar,
    Heart,
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Mock data - Replace with real data from Supabase
const stats = [
    {
        name: 'Total Churches',
        value: '12',
        change: '+2 this month',
        icon: Building2,
        color: 'bg-primary-100 text-primary',
    },
    {
        name: 'Pending Appointments',
        value: '24',
        change: '8 needs attention',
        icon: Calendar,
        color: 'bg-accent-100 text-accent-600',
    },
    {
        name: 'Donations This Month',
        value: '₱45,230',
        change: '+12% from last month',
        icon: Heart,
        color: 'bg-green-100 text-green-600',
    },
    {
        name: 'Active Users',
        value: '1,284',
        change: '+86 this week',
        icon: Users,
        color: 'bg-purple-100 text-purple-600',
    },
];

const recentAppointments = [
    {
        id: 1,
        name: 'Maria Santos',
        service: 'Baptism',
        church: 'St. Peter Parish',
        date: 'Jan 15, 2026',
        status: 'pending',
    },
    {
        id: 2,
        name: 'Juan Reyes',
        service: 'Wedding',
        church: 'Our Lady of Grace',
        date: 'Jan 20, 2026',
        status: 'approved',
    },
    {
        id: 3,
        name: 'Ana Cruz',
        service: 'Confirmation',
        church: 'St. Peter Parish',
        date: 'Jan 22, 2026',
        status: 'pending',
    },
];

const pendingDonations = [
    {
        id: 1,
        name: 'Pedro Lim',
        amount: '₱500',
        church: 'St. Peter Parish',
        date: 'Jan 9, 2026',
    },
    {
        id: 2,
        name: 'Sofia Garcia',
        amount: '₱1,000',
        church: 'Our Lady of Grace',
        date: 'Jan 9, 2026',
    },
];

export default function DashboardPage() {
    const { profile } = useAuth();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="status-pending">Pending</span>;
            case 'approved':
                return <span className="status-approved">Approved</span>;
            case 'rejected':
                return <span className="status-rejected">Rejected</span>;
            default:
                return <span className="badge-default">{status}</span>;
        }
    };

    return (
        <div className="space-y-8 animate-in">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}! 👋
                </h1>
                <p className="text-muted mt-1">
                    Here's what's happening with your parishes today.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="card p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted">{stat.name}</p>
                                <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                                <p className="text-xs text-muted mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {stat.change}
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Appointments */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="card-title">Recent Appointments</h3>
                            <p className="card-description">Latest booking requests</p>
                        </div>
                        <button className="btn-ghost text-sm">View all</button>
                    </div>
                    <div className="card-content">
                        <div className="space-y-4">
                            {recentAppointments.map((apt) => (
                                <div
                                    key={apt.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary-50/50 hover:bg-secondary-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{apt.name}</p>
                                            <p className="text-sm text-muted">
                                                {apt.service} • {apt.church}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {getStatusBadge(apt.status)}
                                        <p className="text-xs text-muted mt-1 flex items-center gap-1 justify-end">
                                            <Clock className="w-3 h-3" />
                                            {apt.date}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Pending Donations */}
                <div className="card">
                    <div className="card-header flex items-center justify-between">
                        <div>
                            <h3 className="card-title">Pending Donations</h3>
                            <p className="card-description">Awaiting verification</p>
                        </div>
                        <button className="btn-ghost text-sm">View all</button>
                    </div>
                    <div className="card-content">
                        <div className="space-y-4">
                            {pendingDonations.map((donation) => (
                                <div
                                    key={donation.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary-50/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center">
                                            <Heart className="w-5 h-5 text-accent-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{donation.name}</p>
                                            <p className="text-sm text-muted">{donation.church}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-foreground">{donation.amount}</p>
                                        <p className="text-xs text-muted">{donation.date}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button className="btn-primary flex-1">
                                    <CheckCircle className="w-4 h-4" />
                                    Verify All
                                </button>
                                <button className="btn-outline flex-1">
                                    <AlertCircle className="w-4 h-4" />
                                    Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Quick Actions</h3>
                    <p className="card-description">Common tasks and shortcuts</p>
                </div>
                <div className="card-content">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary-50/50 transition-all group">
                            <div className="p-3 rounded-xl bg-primary-100 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">Add Church</span>
                        </button>
                        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-accent hover:bg-accent-50/50 transition-all group">
                            <div className="p-3 rounded-xl bg-accent-100 text-accent-600 group-hover:bg-accent group-hover:text-white transition-colors">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">View Schedule</span>
                        </button>
                        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-green-500 hover:bg-green-50/50 transition-all group">
                            <div className="p-3 rounded-xl bg-green-100 text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                <Heart className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">Verify Donations</span>
                        </button>
                        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-purple-500 hover:bg-purple-50/50 transition-all group">
                            <div className="p-3 rounded-xl bg-purple-100 text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <Users className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-medium">Manage Users</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
