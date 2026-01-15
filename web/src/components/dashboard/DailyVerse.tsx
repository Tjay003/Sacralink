import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';

interface Verse {
    text: string;
    reference: string;
}

const FALLBACK_VERSES = [
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

export default function DailyVerse() {
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
        } catch (err) {
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

    return (
        <div className="rounded-lg shadow-sm bg-blue-900 text-white p-6 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <BookOpen className="w-32 h-32" />
            </div>

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-blue-200">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">Daily Verse</span>
                    </div>
                    <button
                        onClick={fetchVerse}
                        disabled={loading}
                        className="p-1 hover:bg-blue-800 rounded-full transition-colors"
                        title="Get new verse"
                    >
                        <RefreshCw className={`w-4 h-4 text-blue-200 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {verse ? (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <p className="text-lg md:text-xl font-serif leading-relaxed opacity-95">
                            "{verse.text}"
                        </p>
                        <p className="text-sm font-medium text-blue-200 text-right">
                            — {verse.reference}
                        </p>
                    </div>
                ) : (
                    <div className="h-32 flex items-center justify-center">
                        <div className="animate-pulse bg-blue-800 h-4 w-3/4 rounded"></div>
                    </div>
                )}
            </div>
        </div>
    );
}
