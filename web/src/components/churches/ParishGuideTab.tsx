import { useState, useMemo } from 'react';
import {
    BookOpen,
    Search,
    X,
    ChevronDown,
    Sparkles,
    HelpCircle,
    Info,
    Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Church } from '../../hooks/useChurches';
import type { ChurchKnowledgeSection } from '../../lib/supabase/churchKnowledge';

interface ParishGuideTabProps {
    church: Church;
    sections: ChurchKnowledgeSection[];
    loading?: boolean;
    onNavigateTab?: (tab: 'liturgy' | 'overview') => void;
}

export default function ParishGuideTab({
    church,
    sections,
    loading = false,
    onNavigateTab,
}: ParishGuideTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Filter sections by search query in real time across title and content
    const filteredSections = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return sections;
        return sections.filter(
            (section) =>
                section.title.toLowerCase().includes(query) ||
                section.content.toLowerCase().includes(query)
        );
    }, [sections, searchQuery]);

    const toggleSection = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        if (expandedIds.size === filteredSections.length) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(filteredSections.map((s) => s.id)));
        }
    };

    const handleAskAssistant = (section: ChurchKnowledgeSection) => {
        window.dispatchEvent(
            new CustomEvent('sacralink:open-assistant', {
                detail: {
                    churchId: church.id,
                    churchName: church.name,
                    query: `Tell me more about: ${section.title}`,
                },
            })
        );
    };

    const formatUpdated = (dateStr: string | null) => {
        if (!dateStr) return null;
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Search Control Strip */}
            <div className="bg-white border border-border rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Parish Guidelines & FAQs</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">
                            Parish Guide & Frequently Asked Questions
                        </h2>
                        <p className="text-xs sm:text-sm text-muted">
                            Explore dress codes, sacrament requirements, parish policies, and guidance for{' '}
                            <span className="font-semibold text-foreground">{church.name}</span>.
                        </p>
                    </div>

                    {sections.length > 0 && (
                        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                            <button
                                type="button"
                                onClick={handleExpandAll}
                                className="text-xs font-semibold text-primary hover:text-primary-700 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 transition-colors cursor-pointer"
                            >
                                {expandedIds.size === filteredSections.length && filteredSections.length > 0
                                    ? 'Collapse all'
                                    : 'Expand all'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Search Bar */}
                {sections.length > 0 && (
                    <div className="relative pt-1">
                        <div className="relative flex items-center">
                            <Search className="w-4 h-4 text-muted absolute left-3.5 pointer-events-none" />
                            <input
                                type="text"
                                data-testid="faq-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search pastoral guidelines, godparent rules, dress codes, fees, or FAQs..."
                                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-secondary-50/60 hover:bg-white focus:bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted transition-all shadow-inner/5"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 p-1 text-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                    aria-label="Clear search query"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Search Feedback */}
                        {searchQuery && (
                            <div className="mt-2 text-xs text-muted flex items-center justify-between px-1">
                                <span>
                                    Found <strong className="text-foreground">{filteredSections.length}</strong>{' '}
                                    topic{filteredSections.length === 1 ? '' : 's'} matching &ldquo;{searchQuery}&rdquo;
                                </span>
                                {filteredSections.length > 0 && (
                                    <span className="text-[11px] text-secondary-500">
                                        Click any card to read full details
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-border rounded-2xl p-5 shadow-2xs animate-pulse space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <div className="h-4 bg-secondary-100 rounded-md w-1/3" />
                                <div className="h-4 w-4 bg-secondary-100 rounded-full" />
                            </div>
                            <div className="h-3 bg-secondary-50 rounded-md w-2/3" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State: No Guide Sections published yet */}
            {!loading && sections.length === 0 && (
                <div className="bg-white border border-border rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-2xs max-w-xl mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-base sm:text-lg font-bold text-foreground">
                            No Parish Guidelines Published Yet
                        </h3>
                        <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-md mx-auto">
                            The parish office has not posted custom pastoral guidelines, dress codes, or FAQs for this church profile yet.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                window.dispatchEvent(
                                    new CustomEvent('sacralink:open-assistant', {
                                        detail: {
                                            churchId: church.id,
                                            churchName: church.name,
                                            query: 'What are the general guidelines and services offered at this parish?',
                                        },
                                    })
                                );
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-600 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Ask Parish Assistant ✨</span>
                        </button>

                        {onNavigateTab && (
                            <button
                                type="button"
                                onClick={() => onNavigateTab('liturgy')}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-secondary-50 hover:bg-secondary-100 active:scale-95 text-secondary-800 text-xs sm:text-sm font-semibold rounded-xl border border-border transition-all cursor-pointer"
                            >
                                <Calendar className="w-4 h-4 text-secondary-600" />
                                <span>View Mass Schedules</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State: Search filter returns 0 results */}
            {!loading && sections.length > 0 && filteredSections.length === 0 && (
                <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 text-center space-y-3 shadow-2xs">
                    <div className="w-12 h-12 rounded-xl bg-secondary-100 text-secondary-500 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                        No matching topics found
                    </h3>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                        We could not find any guidelines or FAQs matching &ldquo;{searchQuery}&rdquo;. Try using broader terms like &ldquo;baptism&rdquo;, &ldquo;mass&rdquo;, or &ldquo;dress code&rdquo;.
                    </p>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                            Clear search filter
                        </button>
                    </div>
                </div>
            )}

            {/* Accordion Cards List */}
            {!loading && filteredSections.length > 0 && (
                <div className="space-y-3" data-testid="faq-accordion-list">
                    {filteredSections.map((section, idx) => {
                        const isExpanded = expandedIds.has(section.id);
                        const updatedTime = formatUpdated(section.updated_at);

                        return (
                            <div
                                key={section.id}
                                data-testid={`faq-accordion-item-${section.id}`}
                                className="bg-white border border-border rounded-2xl shadow-2xs overflow-hidden transition-all duration-200 hover:border-primary/40"
                            >
                                {/* Accordion Header Button */}
                                <button
                                    type="button"
                                    data-testid={`faq-accordion-toggle-${section.id}`}
                                    onClick={() => toggleSection(section.id)}
                                    aria-expanded={isExpanded}
                                    className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-secondary-50/60 cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                isExpanded
                                                    ? 'bg-primary text-white shadow-xs'
                                                    : 'bg-primary/10 text-primary'
                                            }`}
                                        >
                                            <HelpCircle className="w-4 h-4" />
                                        </div>

                                        <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                                                    {section.title}
                                                </h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-100 text-secondary-700">
                                                    Topic #{idx + 1}
                                                </span>
                                            </div>

                                            {updatedTime && (
                                                <p className="text-[11px] text-muted flex items-center gap-1">
                                                    <span>Updated {updatedTime}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-muted font-medium hidden sm:inline">
                                            {isExpanded ? 'Hide' : 'Read'}
                                        </span>
                                        <div
                                            className={`p-1.5 rounded-lg text-secondary-500 hover:text-foreground transition-transform duration-200 ${
                                                isExpanded ? 'rotate-180 text-primary' : ''
                                            }`}
                                        >
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>

                                {/* Accordion Expanded Body */}
                                {isExpanded && (
                                    <div
                                        data-testid={`faq-accordion-body-${section.id}`}
                                        className="border-t border-border/60 bg-secondary-50/30 p-4 sm:p-6 space-y-5 animate-in fade-in duration-200"
                                    >
                                        {/* Guide Content Text */}
                                        <div className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                                            {section.content}
                                        </div>

                                        {/* Contextual Assistant Deep-Linking Footer */}
                                        <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-1.5 text-xs text-muted">
                                                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span>
                                                    Need specific clarifications or ready to book? Ask below:
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                data-testid={`ask-assistant-${section.id}`}
                                                onClick={() => handleAskAssistant(section)}
                                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                                                title="Open AI Parish Assistant with this guide topic"
                                            >
                                                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                                                <span>Have questions about this? Ask Parish Assistant ✨</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
