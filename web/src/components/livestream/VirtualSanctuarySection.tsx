import { useState } from 'react';
import { Sparkles, BookOpen, Scroll, Heart } from 'lucide-react';
import LivestreamPlayer from './LivestreamPlayer';
import SpiritualReactionsBar from './SpiritualReactionsBar';
import VirtualSanctuarySidebar from './VirtualSanctuarySidebar';
import Modal from '../ui/Modal';
import type { Church as DbChurch } from '../../types/database';
import type { Church } from '../../hooks/useChurches';

interface VirtualSanctuarySectionProps {
    church: Church;
}

export default function VirtualSanctuarySection({ church }: VirtualSanctuarySectionProps) {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [activeModalTab, setActiveModalTab] = useState<'liturgy' | 'intentions' | 'offertory'>('liturgy');
    const [candleCount, setCandleCount] = useState<number>(church.candle_count || 0);

    const handleOpenModal = (tab: 'liturgy' | 'intentions' | 'offertory') => {
        setActiveModalTab(tab);
        setIsModalOpen(true);
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
                        type="button"
                        onClick={() => handleOpenModal('liturgy')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isModalOpen && activeModalTab === 'liturgy'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40 shadow-2xs'
                        }`}
                        title="Daily Gospel & Spiritual Communion"
                    >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="sm:hidden">Gospel</span>
                        <span className="hidden sm:inline">Daily Gospel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenModal('intentions')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isModalOpen && activeModalTab === 'intentions'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40 shadow-2xs'
                        }`}
                        title="Mass Intentions"
                    >
                        <Scroll className="w-3.5 h-3.5 shrink-0" />
                        <span>Intentions</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenModal('offertory')}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-200 border cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            isModalOpen && activeModalTab === 'offertory'
                                ? 'bg-primary text-white border-primary shadow-sm shadow-blue-500/20'
                                : 'bg-white dark:bg-card text-muted hover:text-foreground border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:border-primary/40 shadow-2xs'
                        }`}
                        title="Digital Offertory"
                    >
                        <Heart className="w-3.5 h-3.5 shrink-0" />
                        <span>Offertory</span>
                    </button>
                </div>
            </div>

            {/* Main Sanctuary Area: Clean Full-Width Layout */}
            <div className="space-y-5 w-full">
                <LivestreamPlayer
                    church={church}
                    candleCount={candleCount}
                />

                {/* Interactive Spiritual Reactions and Candle Lighting */}
                <SpiritualReactionsBar
                    church={church as unknown as DbChurch}
                    currentCandleCount={candleCount}
                    onCandleCountChange={(newCount) => setCandleCount(newCount)}
                />
            </div>

            {/* Dedicated Modal for Gospel, Mass Intentions, and Digital Offertory */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                size="2xl"
                showCloseButton={false}
                bodyClassName="p-0 flex flex-col"
                className="max-h-[85vh] overflow-hidden dark:bg-card border border-border"
            >
                <VirtualSanctuarySidebar
                    church={church}
                    activeTab={activeModalTab}
                    onTabChange={(tab) => setActiveModalTab(tab)}
                    onClose={() => setIsModalOpen(false)}
                    className="border-none shadow-none rounded-none h-full"
                />
            </Modal>
        </section>
    );
}
