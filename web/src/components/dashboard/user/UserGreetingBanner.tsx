import { format } from 'date-fns';
import { Church } from 'lucide-react';
import { getLiturgicalSeason } from '../../../lib/liturgy';

interface UserGreetingBannerProps {
    userName?: string | null;
    churchName?: string | null;
}

export default function UserGreetingBanner({ userName, churchName }: UserGreetingBannerProps) {
    const today = new Date();
    const liturgicalSeason = getLiturgicalSeason(today);

    // Color themes for liturgical dot
    const dotColors: Record<string, string> = {
        green: 'bg-emerald-500',
        purple: 'bg-purple-500',
        red: 'bg-red-500',
        white: 'bg-amber-400',
        rose: 'bg-rose-400',
    };

    const seasonDot = dotColors[liturgicalSeason.liturgicalColor] || 'bg-emerald-500';
    const formattedDate = format(today, 'EEEE, MMMM d, yyyy');
    const firstName = userName?.trim().split(' ')[0] || 'Kaibigan';

    return (
        <section className="relative w-full rounded-3xl bg-gradient-to-r from-blue-100/70 via-white/80 via-40% to-amber-100/80 border border-amber-200/60 shadow-xs p-6 sm:p-7 lg:p-8 overflow-hidden">
            {/* Ambient Faith Blue and Sacred Gold glows (2x richness) */}
            <div className="absolute -top-14 -left-14 w-80 h-80 bg-blue-200/60 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-14 -right-14 w-96 h-96 bg-amber-200/70 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                {/* Top Row: Liturgical Season & Vestment Badges */}
                <div className="flex items-center gap-2 flex-wrap mb-2.5">
                    <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase shrink-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${seasonDot}`} />
                        {liturgicalSeason.label}
                    </span>
                    <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/90 text-amber-900 border border-amber-300 shadow-2xs text-[11px] font-bold tracking-wider uppercase shrink-0">
                        <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${seasonDot}`} />
                        {liturgicalSeason.colorName} vestments
                    </span>
                </div>

                {/* Formatted Date */}
                <p className="text-sm font-medium text-secondary-500 mb-1">
                    {formattedDate}
                </p>

                {/* Greeting Headline */}
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-bold text-foreground tracking-tight leading-tight">
                    Magandang araw, {firstName}
                </h1>

                {/* Home Parish & Parishioner Status Badge */}
                {churchName && (
                    <div className="flex items-center gap-2 flex-wrap pt-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-primary border border-blue-200/80 text-xs font-semibold shrink-0">
                            <Church className="w-3.5 h-3.5" />
                            {churchName}
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary-100 text-secondary-700 border border-secondary-200 text-xs font-medium shrink-0">
                            Parishioner
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}
