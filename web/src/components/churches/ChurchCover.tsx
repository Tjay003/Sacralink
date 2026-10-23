import { useState } from 'react';
import { Church } from 'lucide-react';

// Three on-brand blue gradients; a church always gets the same one so its card stays recognisable.
const GRADIENTS = [
    'from-primary-600 via-primary-800 to-primary-950',
    'from-primary-700 via-primary-900 to-slate-900',
    'from-primary-500 via-primary-700 to-primary-950',
];

function gradientFor(name: string): string {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return GRADIENTS[hash % GRADIENTS.length];
}

interface ChurchCoverProps {
    /** The church's featured image. Empty, or a link that fails to load, shows the branded design instead. */
    src?: string | null;
    name: string;
    imageClassName?: string;
}

/**
 * ChurchCover - fills its (relatively positioned) parent with the church photo, or with a branded design when the
 * church has no photo or the photo cannot be loaded: a blue gradient, a soft sacred-gold glow and a faint church icon.
 */
export default function ChurchCover({ src, name, imageClassName = '' }: ChurchCoverProps) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    if (src && failedSrc !== src) {
        return (
            <img
                src={src}
                alt={name}
                className={`w-full h-full object-cover ${imageClassName}`}
                onError={() => setFailedSrc(src)}
            />
        );
    }

    return (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(name)}`} role="img" aria-label={`${name} (no photo yet)`}>
            <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-accent-500/25 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-primary-500/25 blur-3xl" aria-hidden="true" />
            <Church className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-28 h-28 text-white/15" strokeWidth={1.25} aria-hidden="true" />
        </div>
    );
}
