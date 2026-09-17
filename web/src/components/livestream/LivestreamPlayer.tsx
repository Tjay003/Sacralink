import { useState, useMemo, useEffect } from 'react';
import {
    Tv,
    Radio,
    Maximize2,
    Minimize2,
    Calendar,
    Clock,
    Flame,
    ExternalLink,
    Sparkles,
    Share2,
    Check
} from 'lucide-react';
import type { Church, MassSchedule } from '../../types/database';

interface LivestreamPlayerProps {
    church: Church & { mass_schedules?: MassSchedule[] };
    candleCount?: number;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    className?: string;
}

export type ParsedStream = {
    platform: 'youtube' | 'facebook' | 'generic';
    embedUrl: string;
    originalUrl: string;
} | null;

/**
 * Robust stream parser for YouTube (videos, live, shortlinks, embed IDs)
 * and Facebook Live (video permalinks, fb.watch, live streams).
 */
export function parseStreamUrl(url?: string | null, platformPreference?: string | null): ParsedStream {
    if (!url || !url.trim()) return null;
    const clean = url.trim();

    // Direct iframe src extraction if user pasted full <iframe>
    const iframeSrcMatch = clean.match(/src=["']([^"']+)["']/i);
    if (iframeSrcMatch && iframeSrcMatch[1]) {
        const src = iframeSrcMatch[1];
        if (src.includes('youtube') || src.includes('youtu.be')) {
            return { platform: 'youtube', embedUrl: src, originalUrl: clean };
        }
        if (src.includes('facebook.com')) {
            return { platform: 'facebook', embedUrl: src, originalUrl: clean };
        }
        return { platform: 'generic', embedUrl: src, originalUrl: clean };
    }

    // YouTube formats
    const ytWatch = clean.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i);
    if (ytWatch && ytWatch[1]) {
        const videoId = ytWatch[1];
        return {
            platform: 'youtube',
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
            originalUrl: clean,
        };
    }

    // Direct YouTube 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
        return {
            platform: 'youtube',
            embedUrl: `https://www.youtube-nocookie.com/embed/${clean}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
            originalUrl: `https://www.youtube.com/watch?v=${clean}`,
        };
    }

    // Facebook formats
    if (clean.includes('facebook.com') || clean.includes('fb.watch') || clean.includes('fb.me') || platformPreference === 'facebook') {
        const encoded = encodeURIComponent(clean);
        return {
            platform: 'facebook',
            embedUrl: `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&autoplay=true&mute=0&allowfullscreen=true`,
            originalUrl: clean,
        };
    }

    // Generic fallback URL if valid http/https
    if (/^https?:\/\//i.test(clean)) {
        return {
            platform: 'generic',
            embedUrl: clean,
            originalUrl: clean,
        };
    }

    return null;
}

/**
 * Format 24-hour time to 12-hour AM/PM
 */
function formatTime12(timeStr?: string | null): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the next upcoming scheduled mass
 */
export function getNextUpcomingMass(schedules?: MassSchedule[] | null) {
    if (!schedules || schedules.length === 0) return null;

    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutesSinceMidnight = currentHour * 60 + currentMinute;

    interface MassCandidate {
        schedule: MassSchedule;
        dayDiff: number;
        minutesUntil: number;
        dayLabel: string;
    }

    const candidates: MassCandidate[] = [];

    for (const schedule of schedules) {
        const scheduleDay = schedule.day_of_week;
        let dayIndex = DAYS_OF_WEEK.findIndex(d => d.toLowerCase() === scheduleDay.toLowerCase());
        if (dayIndex === -1) {
            // Check numeric day of week (0-6)
            const num = parseInt(scheduleDay, 10);
            if (!isNaN(num) && num >= 0 && num <= 6) dayIndex = num;
            else continue;
        }

        const [hStr, mStr] = schedule.time.split(':');
        const massMinutesSinceMidnight = parseInt(hStr || '0', 10) * 60 + parseInt(mStr || '0', 10);

        let dayDiff = dayIndex - currentDayIndex;
        if (dayDiff < 0) {
            dayDiff += 7;
        } else if (dayDiff === 0 && massMinutesSinceMidnight < currentMinutesSinceMidnight) {
            dayDiff = 7;
        }

        const minutesUntil = dayDiff * 24 * 60 + (massMinutesSinceMidnight - currentMinutesSinceMidnight);
        const dayLabel = dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : DAYS_OF_WEEK[dayIndex];

        candidates.push({
            schedule,
            dayDiff,
            minutesUntil,
            dayLabel,
        });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.minutesUntil - b.minutesUntil);
    return candidates[0];
}

export default function LivestreamPlayer({
    church,
    candleCount,
    isSidebarOpen = true,
    onToggleSidebar,
    className = '',
}: LivestreamPlayerProps) {
    const [isLocalTheater, setIsLocalTheater] = useState(false);
    const effectiveTheater = onToggleSidebar ? !isSidebarOpen : isLocalTheater;
    const [copied, setCopied] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const isLive = Boolean(church.is_live && church.livestream_url);
    const parsedStream = useMemo(() => parseStreamUrl(church.livestream_url, church.livestream_platform), [
        church.livestream_url,
        church.livestream_platform,
    ]);

    const nextMass = useMemo(() => getNextUpcomingMass(church.mass_schedules), [church.mass_schedules, currentTime]);

    const activeCandles = candleCount !== undefined ? candleCount : (church.candle_count || 0);

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `${church.name} - Live Holy Mass`,
                    text: `Watch the Holy Mass live broadcast from ${church.name} on Sacralink Virtual Sanctuary`,
                    url: window.location.href,
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            }
        } catch {
            // Ignored
        }
    };

    return (
        <div className={`flex flex-col transition-all duration-300 ${effectiveTheater ? 'w-full' : ''} ${className}`}>
            {/* Main Video Frame */}
            <div className={`relative w-full flex flex-col ${isLive && parsedStream ? 'aspect-video bg-black' : 'bg-secondary-50/50 dark:bg-card min-h-[420px]'} rounded-3xl overflow-hidden border border-border shadow-md group select-none`}>
                {isLive && parsedStream ? (
                    <>
                        {/* Live Video Iframe */}
                        <iframe
                            src={parsedStream.embedUrl}
                            title={church.livestream_title || `${church.name} Holy Mass Broadcast`}
                            className="w-full h-full border-0 absolute inset-0 z-0 bg-black"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />

                        {/* Top Ambient Badges Overlay */}
                        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                            <div className="flex items-center gap-2 pointer-events-auto">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs shadow-md backdrop-blur-md border border-red-400/40 animate-pulse transition-all duration-200 select-none cursor-default">
                                    <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block" />
                                    <span>LIVE MASS</span>
                                </div>

                                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-md border border-white/20 shadow-xs transition-all duration-200 select-none cursor-default">
                                    <Tv className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="capitalize">{parsedStream.platform} Stream</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pointer-events-auto">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-amber-400 text-xs font-semibold backdrop-blur-md border border-amber-400/30 shadow-xs transition-all duration-200 select-none cursor-default">
                                    <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                                    <span>{activeCandles} Candles Lit</span>
                                </div>

                                <button
                                    onClick={() => {
                                        if (onToggleSidebar) {
                                            onToggleSidebar();
                                        } else {
                                            setIsLocalTheater(!isLocalTheater);
                                        }
                                    }}
                                    className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white transition-all duration-200 backdrop-blur-md border border-white/20 shadow-xs cursor-pointer hover:-translate-y-0.5 active:scale-95"
                                    title={effectiveTheater ? 'Exit Theater Mode (Open Sidebar)' : 'Theater Mode (Collapse Sidebar)'}
                                >
                                    {effectiveTheater ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Bottom Gradient Overlay for Stream Title */}
                        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none flex items-end justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="text-white max-w-xl">
                                <h3 className="text-base font-bold truncate">
                                    {church.livestream_title || `${church.name} • Solemn Liturgy`}
                                </h3>
                                <p className="text-xs text-white/80 truncate">
                                    {church.address}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pointer-events-auto">
                                {church.facebook_url && (
                                    <a
                                        href={church.facebook_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-white/90 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-all duration-200 backdrop-blur-md border border-white/20 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Parish Page</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Offline / Standby Ecclesiastical Screen */
                    <div className="flex-1 w-full flex flex-col justify-between p-4 sm:p-6 md:p-8 text-foreground bg-secondary-50/50 dark:bg-card relative">
                        {/* Background with Ambient Image & Subtle Light/Dark Tint */}
                        <div className="absolute inset-0 z-0">
                            <img
                                src={
                                    church.featured_image_url ||
                                    church.panorama_url ||
                                    'https://images.unsplash.com/photo-1548625361-ec85301ff7a6?auto=format&fit=crop&q=80&w=1200'
                                }
                                alt={church.name}
                                className="w-full h-full object-cover opacity-15 filter blur-xs scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/70 to-secondary-50/80 dark:from-card/95 dark:via-card/85 dark:to-card/75" />
                        </div>

                        {/* Top Header inside Standby Screen */}
                        <div className="relative z-10 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-secondary-900/90 border border-border text-xs text-muted font-medium shadow-xs backdrop-blur-md">
                                    <Radio className="w-3.5 h-3.5 text-muted" />
                                    <span>Broadcast Offline</span>
                                </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => {
                                        if (onToggleSidebar) {
                                            onToggleSidebar();
                                        } else {
                                            setIsLocalTheater(!isLocalTheater);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white dark:bg-secondary-900/90 dark:hover:bg-secondary-800 text-xs text-foreground font-medium transition-all duration-200 border border-border shadow-xs backdrop-blur-md cursor-pointer hover:-translate-y-0.5 active:scale-95"
                                    title={effectiveTheater ? 'Exit Theater Mode (Open Sidebar)' : 'Theater Mode (Collapse Sidebar)'}
                                >
                                    {effectiveTheater ? <Minimize2 className="w-3.5 h-3.5 text-muted" /> : <Maximize2 className="w-3.5 h-3.5 text-muted" />}
                                    <span className="hidden sm:inline">{effectiveTheater ? 'Exit Theater' : 'Theater'}</span>
                                </button>

                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-white/95 hover:bg-white dark:bg-secondary-900/90 dark:hover:bg-secondary-800 text-xs text-foreground font-medium transition-all duration-200 border border-border shadow-xs backdrop-blur-md cursor-pointer hover:-translate-y-0.5 active:scale-95"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-muted" />}
                                    <span>{copied ? 'Link Copied!' : 'Share'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Middle Info */}
                        <div className="relative z-10 max-w-2xl py-2 sm:py-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-2.5 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Sacralink Virtual Sanctuary</span>
                            </div>

                            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight leading-snug mb-2 break-words">
                                {church.name}
                            </h2>

                            <p className="text-xs sm:text-sm text-muted line-clamp-2 leading-relaxed mb-4 sm:mb-5">
                                {church.description || 'Welcome to the digital sanctuary. Join our parish community in prayer, follow along with daily liturgical readings, or light a blessed candle.'}
                            </p>

                            {/* Next Mass Timetable Card */}
                            {nextMass ? (
                                <div className="bg-white/95 dark:bg-card/95 border border-border rounded-2xl p-3.5 sm:p-5 shadow-sm backdrop-blur-md max-w-lg">
                                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center shrink-0">
                                                <Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 truncate">
                                                    Next Scheduled Holy Mass
                                                </p>
                                                <p className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">
                                                    {nextMass.dayLabel} at {formatTime12(nextMass.schedule.time)}
                                                </p>
                                                {nextMass.schedule.language && (
                                                    <p className="text-xs text-muted truncate">
                                                        Language: <span className="text-foreground font-medium">{nextMass.schedule.language}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300 text-[10px] sm:text-[11px] font-semibold border border-border whitespace-nowrap">
                                                {nextMass.dayDiff === 0
                                                    ? `In ${Math.floor(nextMass.minutesUntil / 60)}h ${nextMass.minutesUntil % 60}m`
                                                    : nextMass.dayDiff === 1
                                                    ? 'Tomorrow'
                                                    : `In ${nextMass.dayDiff} days`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/95 dark:bg-card/95 border border-border rounded-2xl p-3.5 sm:p-4 text-xs text-muted max-w-lg shadow-xs">
                                    <Clock className="w-4 h-4 text-muted inline mr-1.5" />
                                    Regular Mass schedule is updated weekly by parish administrators.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
