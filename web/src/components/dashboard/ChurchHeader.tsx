import { useNavigate } from 'react-router-dom';
import { Megaphone, Video, Landmark, CheckCircle2, Flame } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';
import { useAuth } from '../../contexts/AuthContext';

interface ChurchHeaderProps {
    churchId: string | null;
    onNewAnnouncement?: () => void;
}

/**
 * ChurchHeader - Elegant editorial header for Church Admin Dashboard
 * Matches reference design:
 * - Liturgical date badge: emerald liturgical dot + uppercase date text in golden pill
 * - Filipino greeting (Magandang umaga / hapon / gabi, [First Name])
 * - Editorial serif parish name
 * - Badges: Verified parish (with CheckCircle2), Your assigned parish, Feast Day pill (with Flame icon)
 * - Right-side action buttons stacked vertically: New announcement (Megaphone), Manage livestream (Video), Parish details (Landmark)
 * - Dual ambient radiant glow: Faith Blue on left, Sacred Gold on right
 */
export default function ChurchHeader({ churchId, onNewAnnouncement }: ChurchHeaderProps) {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { churches, loading } = useChurches();

    const church = churches.find((c) => c.id === churchId);

    // Compute Filipino greeting based on local time
    const getFilipinoGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Magandang umaga';
        if (hour < 18) return 'Magandang hapon';
        return 'Magandang gabi';
    };

    const firstName = profile?.full_name?.split(' ')[0] || 'Parish Admin';

    // Format current day liturgical badge without redundant bullet character
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const liturgicalBadge = `${dayName} · 29TH WEEK IN ORDINARY TIME`;

    if (loading) {
        return (
            <div className="bg-white border border-border rounded-3xl p-6 sm:p-7 lg:p-8 shadow-xs animate-pulse">
                <div className="h-5 bg-secondary-100 rounded w-64 mb-3" />
                <div className="h-4 bg-secondary-100 rounded w-48 mb-3" />
                <div className="h-8 bg-secondary-100 rounded w-80 mb-4" />
                <div className="flex gap-2">
                    <div className="h-6 bg-secondary-100 rounded-full w-28" />
                    <div className="h-6 bg-secondary-100 rounded-full w-36" />
                </div>
            </div>
        );
    }

    if (!church) {
        return (
            <div className="bg-white border border-red-200 rounded-3xl p-6 text-red-900 shadow-xs">
                <h3 className="font-semibold text-lg">Parish Not Found</h3>
                <p className="text-sm text-red-700 mt-1">Unable to load church information. Please contact an administrator.</p>
            </div>
        );
    }

    return (
        <div className="relative rounded-3xl bg-gradient-to-r from-blue-100/70 via-white/80 via-40% to-amber-100/80 border border-amber-200/60 shadow-sm p-6 sm:p-7 lg:p-8 overflow-hidden">
            {/* Ambient Faith Blue and Sacred Gold glows (2x richness) */}
            <div className="absolute -top-14 -left-14 w-80 h-80 bg-blue-200/60 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-14 -right-14 w-96 h-96 bg-amber-200/70 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                {/* Left Info Column */}
                <div className="space-y-3 max-w-3xl">
                    {/* Liturgical Date Badge: Single green dot + golden border pill */}
                    <div>
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                            <span>{liturgicalBadge}</span>
                        </div>
                    </div>

                    {/* Greeting */}
                    <p className="text-sm font-medium text-secondary-500">
                        {getFilipinoGreeting()}, {firstName}
                    </p>

                    {/* Parish Name */}
                    <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-bold text-foreground tracking-tight leading-tight church-hero-title" data-sacred="true">
                        {church.name}
                    </h1>

                    {/* Status Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            Verified parish
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-primary border border-blue-200/80 text-xs font-semibold">
                            Your assigned parish
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-semibold">
                            <Flame className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>
                                Feast of {church.name.replace(/^(Quasi-Parish of|Parish of|San|Santa|Our Lady of)\s+/i, '') || 'Our Lady'} · Sep 19
                            </span>
                        </span>
                    </div>
                </div>

                {/* Right Action Buttons: Stacked vertically */}
                <div className="flex flex-col gap-2.5 w-full sm:w-48 lg:w-52 shrink-0 self-start">
                    <button
                        type="button"
                        onClick={onNewAnnouncement}
                        className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                        <Megaphone className="w-4 h-4 text-white shrink-0" />
                        <span>New announcement</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const el = document.getElementById('live-broadcast-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                        <Video className="w-4 h-4 text-foreground shrink-0" />
                        <span>Manage livestream</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/churches/${churchId}`)}
                        className="w-full inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                        <Landmark className="w-4 h-4 text-foreground shrink-0" />
                        <span>Parish details</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
