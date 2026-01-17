import { Facebook } from 'lucide-react';

interface FacebookFeedProps {
    pageUrl: string;
    height?: number;
}

export default function FacebookFeed({ pageUrl, height = 500 }: FacebookFeedProps) {
    if (!pageUrl) return null;

    // Encode the URL for the iframe src
    const encodedUrl = encodeURIComponent(pageUrl);

    // Facebook Page Plugin Iframe URL
    // Documentation: https://developers.facebook.com/docs/plugins/page-plugin/
    // Note: Facebook officially supports max-width 500px, but setting higher + 100% width sometimes helps responsive containers or at least maximizes it.
    const src = `https://www.facebook.com/plugins/page.php?href=${encodedUrl}&tabs=timeline&width=2000&height=${height}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId`;

    return (
        <div className="card p-0 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-[#1877F2]/5">
                <h2 className="text-lg font-semibold flex items-center text-[#1877F2]">
                    <Facebook className="w-5 h-5 mr-2" />
                    Latest Updates
                </h2>
                <a
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#1877F2] hover:underline"
                >
                    View on Facebook &rarr;
                </a>
            </div>

            <div className="flex-1 bg-white flex justify-center overflow-hidden">
                <iframe
                    src={src}
                    width="100%"
                    height={height}
                    style={{ border: 'none', overflow: 'hidden' }}
                    scrolling="no"
                    frameBorder="0"
                    allowTransparency={true}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen={true}
                    title="Facebook Page Feed"
                />
            </div>
        </div>
    );
}
