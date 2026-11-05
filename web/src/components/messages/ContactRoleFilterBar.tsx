import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ContactRoleTab {
    id: string;
    label: string;
}

interface ContactRoleFilterBarProps {
    tabs: ContactRoleTab[];
    activeTab: string;
    onSelectTab: (tabId: string) => void;
    className?: string;
}

/**
 * ContactRoleFilterBar
 * Sleek, single-row interactive filter bar for contacts modal.
 * Features:
 * - Desktop mousewheel-to-horizontal-scroll translation with passive: false prevention of parent jitter
 * - Mouse drag-to-scroll support with distinction between drags and clicks
 * - Left/right smooth navigation chevrons with soft fade masks when overflow is present
 * - Touch momentum scrolling on mobile
 * - Auto-scrolls active chip into view on selection
 */
export default function ContactRoleFilterBar({
    tabs,
    activeTab,
    onSelectTab,
    className,
}: ContactRoleFilterBarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Mouse drag state
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startScrollLeftRef = useRef(0);
    const dragDistanceRef = useRef(0);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        // 2px margin of error for subpixel rendering
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }, []);

    // Monitor scroll boundaries & window resize
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        checkScroll();

        // Native non-passive wheel event listener translates vertical mousewheel into horizontal scrolling
        const handleWheel = (e: WheelEvent) => {
            if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                const canLeft = el.scrollLeft > 0;
                const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;

                if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY * 0.85;
                }
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                checkScroll();
            });
            resizeObserver.observe(el);
        }

        window.addEventListener('resize', checkScroll);

        return () => {
            el.removeEventListener('wheel', handleWheel);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll]);

    // Recheck scroll when tabs change
    useEffect(() => {
        const id = requestAnimationFrame(checkScroll);
        return () => cancelAnimationFrame(id);
    }, [tabs, checkScroll]);

    const handleScroll = () => {
        checkScroll();
    };

    const scrollByAmount = (offset: number) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: offset, behavior: 'smooth' });
    };

    // Mouse drag handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Left click only
        const el = scrollRef.current;
        if (!el) return;

        isDraggingRef.current = true;
        startXRef.current = e.pageX;
        startScrollLeftRef.current = el.scrollLeft;
        dragDistanceRef.current = 0;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return;
        const el = scrollRef.current;
        if (!el) return;

        const delta = e.pageX - startXRef.current;
        dragDistanceRef.current = Math.abs(delta);

        if (dragDistanceRef.current > 3) {
            el.scrollLeft = startScrollLeftRef.current - delta;
        }
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        // Keep distance for a tick to cancel click event if dragged
        setTimeout(() => {
            dragDistanceRef.current = 0;
        }, 50);
    };

    const handleMouseLeave = () => {
        isDraggingRef.current = false;
        setTimeout(() => {
            dragDistanceRef.current = 0;
        }, 50);
    };

    const handleTabClick = (tabId: string, e: React.MouseEvent<HTMLButtonElement>) => {
        if (dragDistanceRef.current > 4) {
            // Drag action in progress, prevent tab selection
            return;
        }
        onSelectTab(tabId);
        e.currentTarget.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    };

    return (
        <div className={cn('relative group/role-filter w-full', className)}>
            {/* Left Chevron & Fade Mask */}
            {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 bg-gradient-to-r from-white via-white/95 to-transparent pointer-events-none">
                    <button
                        type="button"
                        onClick={() => scrollByAmount(-140)}
                        aria-label="Scroll left"
                        className="pointer-events-auto w-6 h-6 rounded-full bg-white/95 hover:bg-secondary-100 border border-border shadow-xs flex items-center justify-center text-secondary-600 hover:text-foreground transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Chips Scroll Container */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5 cursor-grab active:cursor-grabbing select-none"
                role="tablist"
                aria-label="Filter contacts by role"
            >
                {tabs.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isSelected}
                            type="button"
                            onClick={(e) => handleTabClick(tab.id, e)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all duration-150 cursor-pointer flex-shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                                isSelected
                                    ? 'bg-primary text-white shadow-xs font-semibold'
                                    : 'bg-secondary-50 text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 border border-border/80 hover:border-secondary-300 font-medium'
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Right Chevron & Fade Mask */}
            {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 justify-end bg-gradient-to-l from-white via-white/95 to-transparent pointer-events-none">
                    <button
                        type="button"
                        onClick={() => scrollByAmount(140)}
                        aria-label="Scroll right"
                        className="pointer-events-auto w-6 h-6 rounded-full bg-white/95 hover:bg-secondary-100 border border-border shadow-xs flex items-center justify-center text-secondary-600 hover:text-foreground transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
