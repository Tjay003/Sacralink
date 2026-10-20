import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';

interface Verse {
    text: string;
    reference: string;
}

export interface DailyVerseProps {
    variant?: 'parchment' | 'blue';
    /** Parchment variant only: heading and text of the closing reflection */
    reflectionLabel?: string;
    reflectionText?: string;
}

const FALLBACK_VERSES = [
    {
        text: "Come to me, all who labor and are heavy laden, and I will give you rest.",
        reference: "Matthew 11:28"
    },
    {
        text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
        reference: "Jeremiah 29:11"
    },
    {
        text: "But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.",
        reference: "Isaiah 40:31"
    },
    {
        text: "The Lord is my shepherd; I shall not want.",
        reference: "Psalm 23:1"
    },
    {
        text: "I can do all things through him who strengthens me.",
        reference: "Philippians 4:13"
    },
    {
        text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
        reference: "Romans 8:28"
    }
];

export default function DailyVerse({
    variant = 'parchment',
    reflectionLabel = 'Reflection',
    reflectionText = 'Pause before the first Mass of the day and offer your parish work as a prayer.',
}: DailyVerseProps) {
    const [verse, setVerse] = useState<Verse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchVerse = async () => {
        setLoading(true);
        try {
            // Try to fetch from API
            const response = await fetch('https://bible-api.com/?random=verse');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();

            setVerse({
                text: data.text.trim(),
                reference: data.reference
            });
        } catch {
            // Fallback to local list
            const random = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
            setVerse(random);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerse();
    }, []);

    if (variant === 'parchment') {
        return (
            <div className="rounded-2xl p-6 bg-amber-50/70 border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between h-full">
                {/* Background Cross / Book Watermark */}
                <div className="absolute -top-4 -right-4 p-4 opacity-5 pointer-events-none text-amber-900">
                    <BookOpen className="w-36 h-36" />
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-base">📖</span>
                                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                                    DAILY VERSE
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={fetchVerse}
                                disabled={loading}
                                className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 rounded-full transition-colors cursor-pointer"
                                title="Get new verse"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Verse Quote */}
                        {verse ? (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <p className="font-serif text-lg sm:text-xl text-amber-950 font-medium leading-relaxed italic">
                                    "{verse.text}"
                                </p>
                            </div>
                        ) : (
                            <div className="h-28 flex flex-col justify-center gap-2">
                                <div className="animate-pulse bg-amber-200/60 h-4 w-full rounded"></div>
                                <div className="animate-pulse bg-amber-200/60 h-4 w-4/5 rounded"></div>
                                <div className="animate-pulse bg-amber-200/60 h-4 w-2/3 rounded"></div>
                            </div>
                        )}
                    </div>

                    {/* Reference */}
                    {verse && (
                        <p className="text-xs sm:text-sm font-semibold text-amber-800 text-left mt-3 tracking-tight">
                            {verse.reference}
                        </p>
                    )}

                    {/* Reflection Section */}
                    <div className="mt-4 pt-3 border-t border-amber-200/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                            {reflectionLabel}
                        </span>
                        <p className="text-xs text-amber-950/80 leading-relaxed font-sans">
                            {reflectionText}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Default 'blue' variant
    return (
        <div className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-600 to-blue-400 text-white p-6 relative overflow-hidden flex flex-col justify-between h-full">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <BookOpen className="w-32 h-32" />
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-white/80">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-xs font-medium uppercase tracking-wider">Daily Verse</span>
                        </div>
                        <button
                            type="button"
                            onClick={fetchVerse}
                            disabled={loading}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                            title="Get new verse"
                        >
                            <RefreshCw className={`w-4 h-4 text-white/80 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {verse ? (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            <p className="text-lg md:text-xl font-serif leading-relaxed opacity-95 italic">
                                "{verse.text}"
                            </p>
                        </div>
                    ) : (
                        <div className="h-28 flex items-center justify-center">
                            <div className="animate-pulse bg-blue-800 h-4 w-3/4 rounded"></div>
                        </div>
                    )}
                </div>

                {verse && (
                    <p className="text-sm font-medium text-white/80 text-right mt-4">
                        — {verse.reference}
                    </p>
                )}
            </div>
        </div>
    );
}
