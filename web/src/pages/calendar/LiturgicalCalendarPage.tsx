import { useState, useMemo } from 'react';
import {
    CalendarDays,
    BookOpen,
    Copy,
    Check,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Flame,
    Heart,
    Info,
    Calendar as CalendarIcon,
    Sun,
} from 'lucide-react';
import { getDailyReadings, ACT_OF_SPIRITUAL_COMMUNION, type LiturgicalDay } from '../../lib/liturgy';

interface FeastDay {
    title: string;
    date: string;
    season: string;
    color: 'green' | 'purple' | 'red' | 'white' | 'rose';
    colorName: string;
    obligation?: boolean;
    description: string;
}

const FEAST_DAYS: FeastDay[] = [
    {
        title: 'Solemnity of Mary, Mother of God',
        date: 'January 1',
        season: 'Octave of Christmas',
        color: 'white',
        colorName: 'White',
        obligation: true,
        description: 'Holy Day of Obligation honoring the Blessed Virgin Mary as the Theotokos.',
    },
    {
        title: 'Feast of the Santo Niño',
        date: '3rd Sunday of January',
        season: 'Ordinary Time (Philippines)',
        color: 'white',
        colorName: 'White',
        description: 'Beloved patronal solemnity across the Philippine archipelago.',
    },
    {
        title: 'Ash Wednesday',
        date: 'Beginning of Lent',
        season: 'Lent',
        color: 'purple',
        colorName: 'Violet',
        description: 'Day of universal fast and abstinence, marking the opening of the Lenten journey.',
    },
    {
        title: 'Solemnity of Saint Joseph, Spouse of the Blessed Virgin Mary',
        date: 'March 19',
        season: 'Lent / Solemnity',
        color: 'white',
        colorName: 'White',
        description: 'Patron saint of the universal Church and the City of San Jose del Monte.',
    },
    {
        title: 'Solemnity of the Annunciation of the Lord',
        date: 'March 25',
        season: 'Solemnity',
        color: 'white',
        colorName: 'White',
        description: 'Celebration of the Incarnation of the Son of God in Mary’s womb.',
    },
    {
        title: 'The Resurrection of the Lord (Easter Sunday)',
        date: 'Moveable (Spring)',
        season: 'Easter Season',
        color: 'white',
        colorName: 'White / Gold',
        obligation: true,
        description: 'The pinnacle and foundation of the Christian faith; Christ’s victory over death.',
    },
    {
        title: 'Solemnity of Pentecost',
        date: '50 Days after Easter',
        season: 'Easter Season',
        color: 'red',
        colorName: 'Red',
        obligation: true,
        description: 'Descent of the Holy Spirit upon the Apostles and the birth of the Church.',
    },
    {
        title: 'Solemnity of the Most Sacred Heart of Jesus',
        date: 'Friday after Corpus Christi',
        season: 'Ordinary Time',
        color: 'white',
        colorName: 'White',
        description: 'Devotion to the boundless compassion and divine love of our Savior.',
    },
    {
        title: 'Solemnity of the Assumption of the Blessed Virgin Mary',
        date: 'August 15',
        season: 'Ordinary Time',
        color: 'white',
        colorName: 'White',
        obligation: true,
        description: 'Mary taken body and soul into heavenly glory.',
    },
    {
        title: 'Solemnity of All Saints',
        date: 'November 1',
        season: 'Ordinary Time',
        color: 'white',
        colorName: 'White',
        obligation: true,
        description: 'Honoring all saints in heaven, known and unknown.',
    },
    {
        title: 'Solemnity of Christ the King',
        date: 'Last Sunday of Ordinary Time',
        season: 'Ordinary Time',
        color: 'white',
        colorName: 'White',
        description: 'Culmination of the liturgical year proclaiming Jesus Christ as Lord of the universe.',
    },
    {
        title: 'Solemnity of the Immaculate Conception',
        date: 'December 8',
        season: 'Advent',
        color: 'white',
        colorName: 'White',
        obligation: true,
        description: 'Principal Patroness of the Philippines; Holy Day of Obligation.',
    },
    {
        title: 'The Nativity of the Lord (Christmas)',
        date: 'December 25',
        season: 'Christmas',
        color: 'white',
        colorName: 'White / Gold',
        obligation: true,
        description: 'Incarnation of the Word Made Flesh; Holy Day of Obligation.',
    },
];

const LITURGICAL_COLORS_GUIDE = [
    {
        color: 'green',
        name: 'Green',
        season: 'Ordinary Time',
        meaning: 'Symbol of hope, life, spiritual growth, and perseverance in everyday Christian discipleship.',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotClass: 'bg-emerald-500',
    },
    {
        color: 'purple',
        name: 'Violet / Purple',
        season: 'Advent & Lent',
        meaning: 'Symbol of repentance, penance, prayerful preparation, and spiritual purification.',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
        dotClass: 'bg-purple-600',
    },
    {
        color: 'white',
        name: 'White / Gold',
        season: 'Easter, Christmas, Feasts of the Lord & Mary',
        meaning: 'Symbol of divine light, purity, holiness, joy, and the victory of the Risen Christ.',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
        dotClass: 'bg-amber-400',
    },
    {
        color: 'red',
        name: 'Red',
        season: 'Palm Sunday, Good Friday, Pentecost, Martyrs',
        meaning: 'Symbol of the fire of the Holy Spirit, burning charity, and the sacrificial blood of Christ and martyrs.',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        dotClass: 'bg-rose-600',
    },
    {
        color: 'rose',
        name: 'Rose',
        season: 'Gaudete Sunday (Advent) & Laetare Sunday (Lent)',
        meaning: 'Symbol of anticipated joy and gladness amidst penitential seasons of waiting.',
        badgeClass: 'bg-pink-100 text-pink-800 border-pink-300',
        dotClass: 'bg-pink-500',
    },
];

export default function LiturgicalCalendarPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [copiedLiturgy, setCopiedLiturgy] = useState(false);
    const [copiedPrayer, setCopiedPrayer] = useState(false);

    // Calculate daily readings for selected date
    const dailyReadings: LiturgicalDay = useMemo(() => {
        return getDailyReadings(selectedDate);
    }, [selectedDate]);

    // Generate days of the current week (Sunday to Saturday) relative to the selected date
    const weekDays = useMemo(() => {
        const current = new Date(selectedDate);
        const dayOfWeek = current.getDay();
        const startOfWeek = new Date(current);
        startOfWeek.setDate(current.getDate() - dayOfWeek);

        const days: { date: Date; readings: LiturgicalDay; isSelected: boolean; isToday: boolean }[] = [];
        const todayStr = new Date().toDateString();

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const readings = getDailyReadings(d);
            days.push({
                date: d,
                readings,
                isSelected: d.toDateString() === selectedDate.toDateString(),
                isToday: d.toDateString() === todayStr,
            });
        }
        return days;
    }, [selectedDate]);

    const handlePreviousDay = () => {
        const next = new Date(selectedDate);
        next.setDate(selectedDate.getDate() - 1);
        setSelectedDate(next);
    };

    const handleNextDay = () => {
        const next = new Date(selectedDate);
        next.setDate(selectedDate.getDate() + 1);
        setSelectedDate(next);
    };

    const handleJumpToToday = () => {
        setSelectedDate(new Date());
    };

    const handleCopyGospel = async () => {
        const textToCopy = `${dailyReadings.title} (${dailyReadings.date})\n\nLiturgical Season: ${dailyReadings.season} • Liturgical Color: ${dailyReadings.colorName}\n\nAcclamation:\n${dailyReadings.gospelAcclamation.verse}\n\nGospel (${dailyReadings.gospel.citation}):\n${dailyReadings.gospel.text}\n\nReflection:\n${dailyReadings.reflection || ''}\n\nVia Sacralink - San Jose del Monte, Bulacan`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopiedLiturgy(true);
            setTimeout(() => setCopiedLiturgy(false), 2500);
        } catch {
            // fallback
        }
    };

    const handleCopyPrayer = async () => {
        const text = `${ACT_OF_SPIRITUAL_COMMUNION.title}\nBy ${ACT_OF_SPIRITUAL_COMMUNION.author}\n\n${ACT_OF_SPIRITUAL_COMMUNION.prayer}\n\n(${ACT_OF_SPIRITUAL_COMMUNION.rubric})`;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedPrayer(true);
            setTimeout(() => setCopiedPrayer(false), 2500);
        } catch {
            // fallback
        }
    };

    // Color styling helper
    const getColorTheme = (color: string) => {
        switch (color) {
            case 'purple':
                return {
                    badge: 'bg-purple-50 text-purple-700 border-purple-200',
                    dot: 'bg-purple-600',
                    border: 'border-purple-200',
                    headerBg: 'from-purple-900 to-indigo-900',
                    accentText: 'text-purple-600',
                };
            case 'red':
                return {
                    badge: 'bg-rose-50 text-rose-700 border-rose-200',
                    dot: 'bg-rose-600',
                    border: 'border-rose-200',
                    headerBg: 'from-rose-900 to-red-800',
                    accentText: 'text-rose-600',
                };
            case 'white':
                return {
                    badge: 'bg-amber-50 text-amber-800 border-amber-300',
                    dot: 'bg-amber-400',
                    border: 'border-amber-200',
                    headerBg: 'from-blue-900 via-indigo-900 to-slate-900',
                    accentText: 'text-amber-600',
                };
            case 'rose':
                return {
                    badge: 'bg-pink-50 text-pink-700 border-pink-200',
                    dot: 'bg-pink-500',
                    border: 'border-pink-200',
                    headerBg: 'from-pink-900 to-rose-900',
                    accentText: 'text-pink-600',
                };
            case 'green':
            default:
                return {
                    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    dot: 'bg-emerald-500',
                    border: 'border-emerald-200',
                    headerBg: 'from-emerald-950 via-teal-900 to-slate-900',
                    accentText: 'text-emerald-700',
                };
        }
    };

    const currentTheme = getColorTheme(dailyReadings.liturgicalColor);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        <span>San Jose del Monte, Bulacan</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                        Liturgical Calendar
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary-600 mt-1 max-w-2xl">
                        Daily Roman Catholic lectionary readings, liturgical seasons, sacred Gospel reflections, and parish solemnities.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleJumpToToday}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-border text-foreground hover:bg-secondary-50 shadow-xs transition-colors flex items-center gap-1.5"
                    >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        Today
                    </button>
                    <div className="inline-flex rounded-xl border border-border bg-white shadow-xs overflow-hidden">
                        <button
                            onClick={handlePreviousDay}
                            aria-label="Previous day"
                            className="p-2 hover:bg-secondary-50 text-secondary-600 hover:text-foreground transition-colors border-r border-border"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleNextDay}
                            aria-label="Next day"
                            className="p-2 hover:bg-secondary-50 text-secondary-600 hover:text-foreground transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Week Navigator Strip */}
            <div className="card p-3 sm:p-4 bg-white border border-border rounded-2xl shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-bold text-secondary-500 uppercase tracking-wider">
                        Week of {weekDays[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-muted">
                        Selected: <strong className="text-foreground">{dailyReadings.date}</strong>
                    </span>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {weekDays.map((dayItem) => {
                        const dayTheme = getColorTheme(dayItem.readings.liturgicalColor);
                        return (
                            <button
                                key={dayItem.date.toISOString()}
                                onClick={() => setSelectedDate(dayItem.date)}
                                className={`flex flex-col items-center py-2 sm:py-3 px-1 rounded-xl transition-all duration-150 relative ${
                                    dayItem.isSelected
                                        ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20 scale-[1.02]'
                                        : 'bg-secondary-50/50 hover:bg-secondary-100/70 text-secondary-700'
                                }`}
                            >
                                <span className={`text-[10px] sm:text-xs font-medium uppercase ${dayItem.isSelected ? 'text-blue-100' : 'text-secondary-500'}`}>
                                    {dayItem.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                                </span>
                                <span className="text-sm sm:text-lg font-bold my-0.5">
                                    {dayItem.date.getDate()}
                                </span>

                                <div className="flex items-center gap-1 mt-0.5">
                                    <span
                                        className={`w-2 h-2 rounded-full ${dayTheme.dot}`}
                                        title={`Liturgical Color: ${dayItem.readings.colorName}`}
                                    />
                                    {dayItem.isToday && (
                                        <span className={`text-[9px] font-bold px-1 rounded ${dayItem.isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                            Today
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Two Columns: Day Liturgy Hero & Readings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Liturgical Day Highlight Banner */}
                    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-blue-700 to-indigo-800 p-6 sm:p-7 text-white shadow-sm">
                        <div className="relative z-10 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-sm border border-white/20">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    {dailyReadings.season}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-amber-200 border border-white/15">
                                    <span className={`w-2.5 h-2.5 rounded-full ${currentTheme.dot}`} />
                                    Vestments: {dailyReadings.colorName}
                                </span>
                                <span className="text-xs text-blue-200 ml-auto font-medium">
                                    {dailyReadings.date}
                                </span>
                            </div>

                            <div>
                                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
                                    {dailyReadings.title}
                                </h2>
                                <p className="text-xs sm:text-sm text-blue-100/90 mt-1.5">
                                    Roman Catholic Lectionary for Mass • Universal Norms on the Liturgical Year
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={handleCopyGospel}
                                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center gap-1.5"
                                >
                                    {copiedLiturgy ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Readings Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 text-blue-200" />
                                            <span>Copy Today's Liturgy</span>
                                        </>
                                    )}
                                </button>
                                <a
                                    href={dailyReadings.officialReadingsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-xs"
                                >
                                    <span>USCCB Full Lectionary</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                </a>
                            </div>
                        </div>

                        {/* Subtle Background Motif */}
                        <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-10">
                            <BookOpen className="w-48 h-48 text-white" />
                        </div>
                    </div>

                    {/* Gospel Acclamation */}
                    <div className="card p-5 sm:p-6 bg-white border border-border rounded-2xl shadow-xs">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                Gospel Acclamation
                            </h3>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 text-secondary-900 italic text-sm sm:text-base leading-relaxed">
                            "{dailyReadings.gospelAcclamation.verse}"
                        </div>
                    </div>

                    {/* Holy Gospel Passage */}
                    <div className="card p-5 sm:p-6 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/80">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-primary border border-blue-200">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                                        The Holy Gospel
                                    </h3>
                                    <p className="text-xs text-muted">
                                        Proclamation of the Good News of Jesus Christ
                                    </p>
                                </div>
                            </div>

                            <span className="inline-flex items-center self-start sm:self-auto px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-primary border border-blue-200">
                                {dailyReadings.gospel.citation}
                            </span>
                        </div>

                        <div className="text-secondary-800 text-sm sm:text-base leading-relaxed space-y-3 font-serif">
                            <p className="first-letter:text-3xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:text-primary">
                                {dailyReadings.gospel.text}
                            </p>
                        </div>
                        <p className="text-xs font-semibold text-secondary-500 pt-2 border-t border-border/60">
                            — The Gospel of the Lord. Praise to You, Lord Jesus Christ.
                        </p>
                    </div>

                    {/* Spiritual Reflection */}
                    {dailyReadings.reflection && (
                        <div className="card p-5 sm:p-6 bg-white border border-border rounded-2xl shadow-xs space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Heart className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                                    Daily Spiritual Meditation
                                </h3>
                            </div>
                            <p className="text-sm sm:text-base text-secondary-700 leading-relaxed italic bg-secondary-50/50 p-4 rounded-xl border border-secondary-100">
                                "{dailyReadings.reflection}"
                            </p>
                        </div>
                    )}

                    {/* Act of Spiritual Communion */}
                    <div className="card p-5 sm:p-6 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border/80">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                                    <Flame className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        {ACT_OF_SPIRITUAL_COMMUNION.title}
                                    </h3>
                                    <p className="text-xs text-muted">
                                        By {ACT_OF_SPIRITUAL_COMMUNION.author}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleCopyPrayer}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary-50 text-secondary-700 transition-colors flex items-center gap-1.5 shadow-xs"
                            >
                                {copiedPrayer ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5 text-secondary-500" />
                                        <span>Copy Prayer</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <p className="text-xs sm:text-sm text-secondary-700 leading-relaxed italic bg-amber-50/40 p-4 rounded-xl border border-amber-200/50">
                            "{ACT_OF_SPIRITUAL_COMMUNION.prayer}"
                        </p>

                        <p className="text-[11px] text-muted leading-tight">
                            ℹ️ {ACT_OF_SPIRITUAL_COMMUNION.rubric}
                        </p>
                    </div>
                </div>

                {/* Right Column: Liturgical Colors Guide & Major Solemnities */}
                <div className="space-y-6">
                    {/* Liturgical Colors Guide Card */}
                    <div className="card p-5 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/80">
                            <div className="p-1.5 rounded-lg bg-blue-50 text-primary border border-blue-200">
                                <Info className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">
                                    Catholic Liturgical Colors
                                </h3>
                                <p className="text-[11px] text-muted">
                                    Symbolism of sacred vestments & seasons
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {LITURGICAL_COLORS_GUIDE.map((item) => (
                                <div
                                    key={item.color}
                                    className="p-3 rounded-xl border border-border/80 bg-secondary-50/40 hover:bg-secondary-50 transition-colors space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                                            <span className="text-xs font-bold text-foreground">
                                                {item.name}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeClass}`}>
                                            {item.season}
                                        </span>
                                    </div>
                                    <p className="text-xs text-secondary-600 leading-relaxed">
                                        {item.meaning}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Major Solemnities & Holy Days of Obligation Card */}
                    <div className="card p-5 bg-white border border-border rounded-2xl shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/80">
                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">
                                    Solemnities & Holy Days
                                </h3>
                                <p className="text-[11px] text-muted">
                                    Liturgical calendar in the Philippines
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                            {FEAST_DAYS.map((feast) => {
                                const fTheme = getColorTheme(feast.color);
                                return (
                                    <div
                                        key={feast.title}
                                        className="p-3 rounded-xl border border-border/70 hover:border-border bg-white hover:bg-secondary-50/50 transition-colors space-y-1"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${fTheme.dot}`} />
                                                <h4 className="text-xs font-bold text-foreground leading-snug">
                                                    {feast.title}
                                                </h4>
                                            </div>
                                            {feast.obligation && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex-shrink-0 uppercase tracking-wide">
                                                    Obligation
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] text-primary font-semibold">
                                            <span>{feast.date}</span>
                                            <span className="text-secondary-300">•</span>
                                            <span className="text-secondary-500 font-normal">{feast.season}</span>
                                        </div>

                                        <p className="text-[11px] text-secondary-600 leading-tight">
                                            {feast.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
