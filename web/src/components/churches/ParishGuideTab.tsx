import React, { useState, useMemo } from 'react';
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

interface BulletItem {
    text: string;
    indented: boolean;
}

type GuideBlock =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; lines: string[] }
    | { type: 'bullet-list'; items: BulletItem[] }
    | { type: 'quote'; lines: string[] }
    | { type: 'divider' };

/**
 * Lightweight inline markdown parser for bold, italics, code, and inline formatting.
 */
function parseGuideInline(text: string): React.ReactNode[] {
    if (!text) return [];
    const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|(?<=\s|^)_[^_]+_(?=\s|$|[.,!?;]))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const token = match[0];
        const key = `${match.index}-${token}`;

        if (token.startsWith('`') && token.endsWith('`')) {
            parts.push(
                <code key={key} className="px-1.5 py-0.5 rounded font-mono text-xs bg-secondary-100 text-secondary-900 border border-border">
                    {token.slice(1, -1)}
                </code>
            );
        } else if ((token.startsWith('***') && token.endsWith('***'))) {
            parts.push(
                <strong key={key} className="font-semibold text-foreground">
                    <em className="italic text-secondary-700">
                        {parseGuideInline(token.slice(3, -3))}
                    </em>
                </strong>
            );
        } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
            parts.push(
                <strong key={key} className="font-semibold text-foreground">
                    {parseGuideInline(token.slice(2, -2))}
                </strong>
            );
        } else if (token.startsWith('*') && token.endsWith('*')) {
            parts.push(
                <em key={key} className="italic text-secondary-700">
                    {token.slice(1, -1)}
                </em>
            );
        } else {
            parts.push(token);
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
}

/**
 * Splits plain text response into structured blocks (headings, paragraphs, bullet lists, quotes).
 */
function parseGuideBlocks(content: string): GuideBlock[] {
    const rawLines = content.split(/\r?\n/);
    const blocks: GuideBlock[] = [];

    let currentParagraph: string[] = [];
    let currentBulletList: BulletItem[] = [];
    let currentQuote: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            blocks.push({ type: 'paragraph', lines: [...currentParagraph] });
            currentParagraph = [];
        }
    };

    const flushBulletList = () => {
        if (currentBulletList.length > 0) {
            blocks.push({ type: 'bullet-list', items: [...currentBulletList] });
            currentBulletList = [];
        }
    };

    const flushQuote = () => {
        if (currentQuote.length > 0) {
            blocks.push({ type: 'quote', lines: [...currentQuote] });
            currentQuote = [];
        }
    };

    const flushAll = () => {
        flushParagraph();
        flushBulletList();
        flushQuote();
    };

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            flushAll();
            continue;
        }

        // Horizontal divider: --- or *** or ___
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
            flushAll();
            blocks.push({ type: 'divider' });
            continue;
        }

        // Headings: #, ##, ###, ####
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushAll();
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length,
                text: headingMatch[2],
            });
            continue;
        }

        // Blockquote: > text
        const quoteMatch = trimmed.match(/^>\s*(.*)$/);
        if (quoteMatch) {
            flushParagraph();
            flushBulletList();
            currentQuote.push(quoteMatch[1]);
            continue;
        } else {
            flushQuote();
        }

        // Bullet list item: * text, - text, • text, + text
        const bulletMatch = line.match(/^(\s*)([-*•+])\s+(.+)$/);
        if (bulletMatch) {
            flushParagraph();
            currentBulletList.push({
                indented: bulletMatch[1].length >= 2,
                text: bulletMatch[3],
            });
            continue;
        }

        // Indented list continuations
        if (currentBulletList.length > 0 && /^\s{2,}\S/.test(line)) {
            currentBulletList[currentBulletList.length - 1].text += ' ' + trimmed;
            continue;
        }

        // Regular paragraph line
        flushBulletList();
        currentParagraph.push(line);
    }

    flushAll();
    return blocks;
}

/**
 * Clean, lightweight markdown renderer for pastoral guides and church FAQs.
 */
export function ParishGuideMarkdown({ content }: { content: string }) {
    const blocks = parseGuideBlocks(content);

    return (
        <div className="space-y-3 font-sans" data-testid="parish-guide-markdown">
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'heading': {
                        if (block.level <= 2) {
                            return (
                                <h3
                                    key={idx}
                                    className="text-base sm:text-lg font-bold text-foreground mt-4 mb-1.5 first:mt-0 tracking-tight"
                                >
                                    {parseGuideInline(block.text)}
                                </h3>
                            );
                        }
                        if (block.level === 3) {
                            return (
                                <h4
                                    key={idx}
                                    className="text-sm sm:text-base font-bold text-foreground mt-3.5 mb-1 first:mt-0"
                                >
                                    {parseGuideInline(block.text)}
                                </h4>
                            );
                        }
                        return (
                            <h5
                                key={idx}
                                className="text-xs sm:text-sm font-semibold text-foreground/90 mt-2.5 mb-1 first:mt-0"
                            >
                                {parseGuideInline(block.text)}
                            </h5>
                        );
                    }
                    case 'paragraph':
                        return (
                            <p
                                key={idx}
                                className="text-xs sm:text-sm text-foreground/80 leading-relaxed"
                            >
                                {block.lines.map((line, lIdx) => (
                                    <React.Fragment key={lIdx}>
                                        {lIdx > 0 && <br />}
                                        {parseGuideInline(line)}
                                    </React.Fragment>
                                ))}
                            </p>
                        );
                    case 'bullet-list':
                        return (
                            <ul key={idx} className="space-y-1.5 my-2 pl-0.5">
                                {block.items.map((item, iIdx) => (
                                    <li
                                        key={iIdx}
                                        className={`flex items-start gap-2.5 ${item.indented ? 'ml-4' : ''} text-xs sm:text-sm text-foreground/85 leading-relaxed`}
                                    >
                                        <span
                                            className="inline-block w-1.5 h-1.5 rounded-full mt-2 bg-amber-500 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <span className="flex-1">
                                            {parseGuideInline(item.text)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        );
                    case 'quote':
                        return (
                            <blockquote
                                key={idx}
                                className="pl-3.5 border-l-2 border-amber-400 bg-amber-50/40 py-1.5 rounded-r my-2 text-xs sm:text-sm italic text-secondary-800"
                            >
                                {block.lines.map((line, lIdx) => (
                                    <React.Fragment key={lIdx}>
                                        {lIdx > 0 && <br />}
                                        {parseGuideInline(line)}
                                    </React.Fragment>
                                ))}
                            </blockquote>
                        );
                    case 'divider':
                        return <hr key={idx} className="my-3 border-border/70" />;
                    default:
                        return null;
                }
            })}
        </div>
    );
}

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
                                        <ParishGuideMarkdown content={section.content} />

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
