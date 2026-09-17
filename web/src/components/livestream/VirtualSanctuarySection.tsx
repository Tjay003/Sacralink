import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, BookOpen, Scroll, Heart, PanelRightClose, PanelRightOpen } from 'lucide-react';
import LivestreamPlayer from './LivestreamPlayer';
import SpiritualReactionsBar from './SpiritualReactionsBar';
import VirtualSanctuarySidebar from './VirtualSanctuarySidebar';
import type { MassSchedule } from '../../types/database';

interface VirtualSanctuarySectionProps {
    church: any & { mass_schedules?: MassSchedule[] };
}

export default function VirtualSanctuarySection({ church }: VirtualSanctuarySectionProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1280;
        }
        return true;
    });
    const [activeSidebarTab, setActiveSidebarTab] = useState<'liturgy' | 'intentions' | 'offertory'>('liturgy');
    const [candleCount, setCandleCount] = useState<number>(church.candle_count || 0);

    // Escape key closes open sidebar/drawer
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSidebarOpen) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSidebarOpen]);

    // Lock body scroll only when slide-over drawer is open on mobile/tablet (< 1280px)
    useEffect(() => {
        const updateScrollLock = () => {
            if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1280) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        };

        updateScrollLock();
        window.addEventListener('resize', updateScrollLock);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('resize', updateScrollLock);
        };
    }, [isSidebarOpen]);

    const handleTabClick = (tab: 'liturgy' | 'intentions' | 'offertory') => {
        if (isSidebarOpen && activeSidebarTab === tab) {
            // Clicking the active tab toggles the sidebar closed
            setIsSidebarOpen(false);
        } else {
            setActiveSidebarTab(tab);
            setIsSidebarOpen(true);
        }
    };

    return (
        <section id="virtual-sanctuary" className="space-y-6 pt-2">
            {/* Section Heading with Ecclesiastical Glow */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-4">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold text-xs mb-2 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>Sacralink Virtual Sanctuary</span>
                        {church.is_live && (
                            <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-extrabold ml-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                                </span>
                                LIVE NOW
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                        Live Mass & Virtual Sanctuary
                    </h2>
                    <p className="text-xs sm:text-sm text-muted line-clamp-2 sm:line-clamp-none max-w-2xl mt-1">
                        Participate in holy sacrifice, read today's sacred liturgy, offer silent intentions, and join fellow parishioners in prayer.
                    </p>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
                    <button
                        onClick={() => handleTabClick('liturgy')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isSidebarOpen && activeSidebarTab === 'liturgy'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40'
                        }`}
                        title="Daily Gospel & Spiritual Communion"
                    >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="sm:hidden">Gospel</span>
                        <span className="hidden sm:inline">Daily Gospel</span>
                    </button>

                    <button
                        onClick={() => handleTabClick('intentions')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isSidebarOpen && activeSidebarTab === 'intentions'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40'
                        }`}
                        title="Mass Intentions"
                    >
                        <Scroll className="w-3.5 h-3.5 shrink-0" />
                        <span>Intentions</span>
                    </button>

                    <button
                        onClick={() => handleTabClick('offertory')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isSidebarOpen && activeSidebarTab === 'offertory'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40'
                        }`}
                        title="Digital Offertory"
                    >
                        <Heart className="w-3.5 h-3.5 shrink-0" />
                        <span>Offertory</span>
                    </button>

                    {/* Dedicated Collapse / Expand Toggle Button (Desktop XL only) */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isSidebarOpen
                                ? 'bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 border-border hover:bg-secondary-200 dark:hover:bg-secondary-700'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 shadow-xs'
                        }`}
                        title={isSidebarOpen ? 'Hide Companion Sidebar (Cinema Mode)' : 'Open Sanctuary Companion Sidebar'}
                    >
                        {isSidebarOpen ? (
                            <>
                                <PanelRightClose className="w-3.5 h-3.5 shrink-0" />
                                <span>Hide Sidebar</span>
                            </>
                        ) : (
                            <>
                                <PanelRightOpen className="w-3.5 h-3.5 shrink-0" />
                                <span>Show Sidebar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Sanctuary Area: Responsive Flex Layout */}
            <div className="flex flex-col xl:flex-row gap-6 lg:gap-8 items-start">
                {/* Video Player & Spiritual Reactions Area (Expands to 100% when sidebar is collapsed) */}
                <div className="flex-1 min-w-0 space-y-5 w-full transition-all duration-300">
                    <LivestreamPlayer
                        church={church}
                        candleCount={candleCount}
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    />

                    {/* Interactive Spiritual Reactions and Candle Lighting */}
                    <SpiritualReactionsBar
                        church={church}
                        currentCandleCount={candleCount}
                        onCandleCountChange={(newCount) => setCandleCount(newCount)}
                    />
                </div>

                {/* Desktop Side-by-Side Docked Sidebar (Only displayed on screens >= xl, min-width guaranteed 390px-420px) */}
                {isSidebarOpen && (
                    <div className="hidden xl:block w-[390px] 2xl:w-[420px] shrink-0 sticky top-6 animate-in fade-in slide-in-from-right-3 duration-200">
                        <VirtualSanctuarySidebar
                            church={church}
                            activeTab={activeSidebarTab}
                            onTabChange={(tab) => setActiveSidebarTab(tab)}
                            onClose={() => setIsSidebarOpen(false)}
                        />
                    </div>
                )}
            </div>

            {/* Slide-Over Drawer for Tablets / Laptops / Mobile (< xl) */}
            {isSidebarOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="xl:hidden fixed inset-0 z-50 overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sanctuary Companion Drawer"
                >
                    {/* Darkened Backdrop */}
                    <div
                        className="fixed inset-0 bg-secondary-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                        onClick={() => setIsSidebarOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Slide-in Panel from Right */}
                    <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
                        <div className="w-screen max-w-md bg-white dark:bg-card shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-300">
                            <VirtualSanctuarySidebar
                                church={church}
                                activeTab={activeSidebarTab}
                                onTabChange={(tab) => setActiveSidebarTab(tab)}
                                onClose={() => setIsSidebarOpen(false)}
                                className="h-full border-none shadow-none rounded-none"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    );
}
