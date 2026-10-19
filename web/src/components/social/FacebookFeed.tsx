import {
    Facebook,
    ExternalLink,
    Info,
} from 'lucide-react';
import type { ChurchAnnouncement } from '../../lib/supabase/announcements';
import type { Church } from '../../hooks/useChurches';

interface FacebookFeedProps {
    pageUrl: string;
    height?: number;
    church?: Church | null;
    announcements?: ChurchAnnouncement[];
}

export default function FacebookFeed({
    pageUrl,
    height = 600,
}: FacebookFeedProps) {
    if (!pageUrl) return null;

    // Encode for the Facebook Page Plugin iframe
    const encodedUrl = encodeURIComponent(pageUrl);
    const iframeSrc = `https://www.facebook.com/plugins/page.php?href=${encodedUrl}&tabs=timeline&width=500&height=${height}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId`;

    return (
        <div className="bg-white border border-border/80 shadow-2xs rounded-3xl overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between bg-white gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1877F2] flex items-center justify-center shrink-0">
                        <Facebook className="w-4 h-4 fill-current" />
                    </div>
                    <span className="font-bold text-foreground text-sm sm:text-base truncate">
                        Latest updates
                    </span>
                </div>
                <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#1877F2] hover:text-blue-700 inline-flex items-center gap-1 hover:underline shrink-0"
                >
                    <span>View on Facebook</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>
            </div>

            {/* Helpful Privacy/Cookie Notice Banner */}
            <div className="px-4 py-2.5 bg-blue-50/50 border-b border-border/60 text-[11px] sm:text-xs text-secondary-600 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Info className="w-3.5 h-3.5 text-[#1877F2] shrink-0" />
                    <span className="truncate">If posts don't appear, browser tracking cookies may be blocking the social feed.</span>
                </div>
                <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1877F2] hover:underline shrink-0"
                >
                    Open page &rarr;
                </a>
            </div>

            {/* Facebook Timeline Iframe Area */}
            <div className="flex-1 bg-white overflow-hidden p-3 sm:p-4 flex flex-col items-center justify-center min-h-[420px]">
                <div className="w-full flex justify-center overflow-hidden">
                    <iframe
                        src={iframeSrc}
                        width="500"
                        height={height}
                        style={{
                            border: 'none',
                            overflow: 'hidden',
                            maxWidth: '100%',
                        }}
                        scrolling="no"
                        frameBorder="0"
                        allowTransparency={true}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        allowFullScreen={true}
                        title="Facebook Page Feed"
                    />
                </div>
            </div>
        </div>
    );
}
