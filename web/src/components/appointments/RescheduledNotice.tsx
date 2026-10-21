import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock } from 'lucide-react';
import { getRescheduledNotice, type RescheduledNoticeSource } from '../../lib/rescheduledNotice';

interface RescheduledNoticeProps {
    appointment: RescheduledNoticeSource;
    className?: string;
}

const TOOLTIP_WIDTH = 256;
const VIEWPORT_MARGIN = 8;

/**
 * Amber "Rescheduled from <old date>" chip. The reason shows in a tooltip on hover or keyboard
 * focus (desktop) and toggles on tap/click/Enter (touch). Renders nothing when the appointment
 * was never rescheduled, is not approved, or its new date has passed.
 */
export default function RescheduledNotice({ appointment, className = '' }: RescheduledNoticeProps) {
    const notice = getRescheduledNotice(appointment);
    const tooltipId = useId();
    const chipRef = useRef<HTMLButtonElement>(null);
    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const open = hovered || pinned;

    const close = useCallback(() => {
        setHovered(false);
        setPinned(false);
    }, []);

    /** Anchor the tooltip under the chip, kept inside the viewport (it is portalled to document.body) */
    const measure = useCallback(() => {
        const rect = chipRef.current?.getBoundingClientRect();
        if (!rect) return;
        const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN;
        setPosition({
            top: rect.bottom + 6,
            left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
        });
    }, []);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!chipRef.current?.contains(event.target as Node)) close();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open, close]);

    if (!notice) return null;

    const chipClasses =
        'inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 whitespace-nowrap';
    const label = `Rescheduled from ${notice.fromLabel}`;

    if (!notice.reason) {
        return (
            <span data-testid="rescheduled-notice" className={`${chipClasses} ${className}`}>
                <CalendarClock className="w-3 h-3 shrink-0" aria-hidden="true" />
                {label}
            </span>
        );
    }

    return (
        <>
            <button
                ref={chipRef}
                type="button"
                data-testid="rescheduled-notice"
                aria-expanded={pinned}
                aria-describedby={open ? tooltipId : undefined}
                onPointerEnter={(event) => {
                    if (event.pointerType !== 'mouse') return;
                    measure();
                    setHovered(true);
                }}
                onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
                onFocus={(event) => {
                    // Keyboard focus only: a tap or click also focuses the button, but those toggle instead
                    if (!event.currentTarget.matches(':focus-visible')) return;
                    measure();
                    setHovered(true);
                }}
                onBlur={() => setHovered(false)}
                onClick={(event) => {
                    event.stopPropagation();
                    measure();
                    setPinned((value) => !value);
                }}
                className={`${chipClasses} cursor-pointer hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
            >
                <CalendarClock className="w-3 h-3 shrink-0" aria-hidden="true" />
                {label}
            </button>
            {open &&
                position &&
                createPortal(
                    <div
                        id={tooltipId}
                        role="tooltip"
                        data-testid="rescheduled-notice-reason"
                        style={{ position: 'fixed', top: position.top, left: position.left, width: TOOLTIP_WIDTH }}
                        className="z-[1000] rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs leading-relaxed text-secondary-700 shadow-lg whitespace-normal"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Reason</p>
                        <p className="mt-0.5">{notice.reason}</p>
                    </div>,
                    document.body
                )}
        </>
    );
}
