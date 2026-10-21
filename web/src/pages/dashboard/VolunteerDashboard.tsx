import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
    CheckCircle2,
    ExternalLink,
    Radio,
    AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../hooks/useChurches';
import { SystemAnnouncementsBanner } from '../../components/announcements';
import LiveBroadcastManager from '../../components/dashboard/LiveBroadcastManager';
import ChurchAnnouncementsManagement from '../../components/dashboard/ChurchAnnouncementsManagement';
import DailyVerse from '../../components/dashboard/DailyVerse';
import { getLiturgicalSeason, type LiturgicalSeasonInfo } from '../../lib/liturgy';

interface VolunteerDashboardProps {
    churchId: string | null;
}

const SEASON_DOTS: Record<LiturgicalSeasonInfo['liturgicalColor'], string> = {
    green: 'bg-emerald-500',
    purple: 'bg-violet-500',
    red: 'bg-red-500',
    white: 'bg-white ring-1 ring-amber-300',
    rose: 'bg-pink-400',
};

function getGreeting(hour: number): string {
    if (hour < 12) return 'Magandang umaga';
    if (hour < 18) return 'Magandang hapon';
    return 'Magandang gabi';
}

export default function VolunteerDashboard({ churchId }: VolunteerDashboardProps) {
    const { profile } = useAuth();
    const { church } = useChurch(churchId || undefined);

    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    const season = useMemo(() => getLiturgicalSeason(now), [now]);
    const seasonDot = SEASON_DOTS[season.liturgicalColor];

    const firstName = profile?.full_name?.split(' ')[0] || 'Volunteer';
    const churchName = church?.name || 'Your Assigned Parish';

    if (!churchId) {
        return (
            <div className="space-y-6">
                <SystemAnnouncementsBanner />
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-xs">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-amber-900 mb-2">No Parish Assigned</h3>
                    <p className="text-sm text-amber-800 leading-relaxed">
                        You are registered as a Parish Volunteer, but your account is not yet linked to a specific parish.
                        Please contact your Parish Administrator or Chancery office to assign you to a parish community.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* System Announcements Banner */}
            <SystemAnnouncementsBanner />

            {/* Light SacraLink Liturgical Header for Volunteers */}
            <section className="relative rounded-3xl bg-gradient-to-r from-blue-100/70 via-white/80 via-40% to-amber-100/80 border border-amber-200/60 shadow-sm p-6 sm:p-7 lg:p-8 overflow-hidden">
                {/* Ambient Faith Blue and Sacred Gold glows (2x richness) */}
                <div className="absolute -top-14 -left-14 w-80 h-80 bg-blue-200/60 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -top-14 -right-14 w-96 h-96 bg-amber-200/70 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                    {/* Top Row: Liturgical Season & Vestment Badges */}
                    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-x-auto">
                        <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase shrink-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${seasonDot}`} />
                            {season.label}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase shrink-0">
                            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${seasonDot}`} />
                            {season.colorName} vestments
                        </span>
                    </div>

                    {/* Date */}
                    <p className="text-sm font-medium text-secondary-500 mt-2.5">
                        {format(now, 'EEEE, MMMM d, yyyy')}
                    </p>

                    {/* Greeting & Actions Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-bold text-foreground tracking-tight leading-tight">
                            {getGreeting(now.getHours())}, {firstName}
                        </h1>

                        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                            <Link
                                to={`/churches/${churchId}?tab=livestream`}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <Radio className="w-4 h-4 shrink-0" />
                                Preview Virtual Sanctuary
                            </Link>
                            <Link
                                to={`/churches/${churchId}`}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-secondary-50 text-foreground text-sm font-semibold border border-border shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <ExternalLink className="w-4 h-4 shrink-0 text-muted" />
                                View Parish Page
                            </Link>
                        </div>
                    </div>

                    {/* Volunteer Status Badges Row */}
                    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-x-auto pt-2.5">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-primary border border-blue-200/80 text-xs font-semibold shrink-0">
                            Parish volunteer · {churchName}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            Active Volunteer
                        </span>
                    </div>
                </div>
            </section>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: 7 cols */}
                <div className="lg:col-span-7 space-y-6">
                    {/* 1. Live Broadcast & Virtual Sanctuary Manager */}
                    <LiveBroadcastManager churchId={churchId} />

                    {/* 2. Parish Announcements & Bulletin Board */}
                    <ChurchAnnouncementsManagement churchId={churchId} />
                </div>

                {/* Right Column: 5 cols */}
                <div className="lg:col-span-5 space-y-6">
                    {/* 1. Daily Scripture Verse (Parchment variant) */}
                    <DailyVerse variant="parchment" />
                </div>
            </div>
        </div>
    );
}
