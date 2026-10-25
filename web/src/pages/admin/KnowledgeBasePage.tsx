import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    ChevronDown,
    ChevronUp,
    ArrowLeft,
    AlertCircle,
    CheckCircle,
    XCircle,
    Bot,
    Clock,
    AlertTriangle,
    Sparkles,
    Check,
    MessageSquare,
    RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import Modal from '../../components/ui/Modal';
import { lintKnowledgeSection } from '../../utils/knowledgeLinter';
import { STARTER_FAQ_TEMPLATES } from '../../config/starterFaqTemplates';
import { polishKnowledgeContent, type PolishKnowledgeResult } from '../../lib/supabase/aiScribe';
import { useChatInsights, type InquiryInsightItem } from '../../hooks/useChatInsights';

interface KnowledgeSection {
    id: string;
    title: string;
    content: string;
    display_order: number;
    updated_at: string;
}

export default function KnowledgeBasePage() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const churchId = (profile as any)?.church_id ?? (profile as any)?.assigned_church_id ?? null;
    const canEdit = profile?.role === 'super_admin' || profile?.role === 'church_admin';

    const [churchName, setChurchName] = useState<string>('');
    const [sections, setSections] = useState<KnowledgeSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Tabs state: Knowledge Sections vs Inquiry Insights
    const [activeTab, setActiveTab] = useState<'sections' | 'insights'>('sections');
    const [convertingInquiryId, setConvertingInquiryId] = useState<string | null>(null);

    // Chat Inquiry Insights & Gaps hook
    const {
        totalInquiries,
        unansweredCount,
        recentUnanswered,
        loading: insightsLoading,
        refresh: refreshChatInsights,
        markAsAddressed,
        generateFaqDraft,
    } = useChatInsights(churchId);

    // New / Edit form state
    const [editingId, setEditingId] = useState<string | 'new' | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

    // AI Scribe & Polish state
    const [isPolishing, setIsPolishing] = useState(false);
    const [showPolishReviewModal, setShowPolishReviewModal] = useState(false);
    const [polishedCandidate, setPolishedCandidate] = useState<{
        title: string;
        content: string;
        trace?: PolishKnowledgeResult['trace'];
    } | null>(null);
    const [polishedNotice, setPolishedNotice] = useState(false);

    // Starter FAQ Templates Modal state
    const [showStarterTemplatesModal, setShowStarterTemplatesModal] = useState(false);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
        new Set(STARTER_FAQ_TEMPLATES.map(t => t.id))
    );
    const [bulkInserting, setBulkInserting] = useState(false);
    const [previewingTemplateId, setPreviewingTemplateId] = useState<string | null>(null);

    // Fetch Church Name for AI context
    useEffect(() => {
        if (!churchId) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('churches')
            .select('name')
            .eq('id', churchId)
            .maybeSingle()
            .then(({ data }: { data: { name: string } | null }) => {
                if (data?.name) setChurchName(data.name);
            });
    }, [churchId]);

    // Real-time SSOT discrepancy linter
    const lintResult = useMemo(
        () => lintKnowledgeSection(formTitle, formContent),
        [formTitle, formContent]
    );

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);

    // Load last synced time from localStorage
    useEffect(() => {
        if (!churchId) return;
        const stored = localStorage.getItem(`kb_last_synced_${churchId}`);
        if (stored) {
            const daysSince = (Date.now() - new Date(stored).getTime()) / (1000 * 60 * 60 * 24);
            setLastSynced(new Date(stored).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }));
            setIsStale(daysSince > 7);
        } else {
            setIsStale(true); // Never synced
        }
    }, [churchId]);

    const fetchSections = useCallback(async () => {
        if (!churchId) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('church_knowledge_sections')
            .select('id, title, content, display_order, updated_at')
            .eq('church_id', churchId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (!error && data) setSections(data as KnowledgeSection[]);
        setLoading(false);
    }, [churchId]);

    useEffect(() => {
        fetchSections();
    }, [fetchSections]);

    const openNew = () => {
        setActiveTab('sections');
        setEditingId('new');
        setFormTitle('');
        setFormContent('');
        setSaveError(null);
        setShowDiscrepancyModal(false);
        setExpandedId(null);
        setConvertingInquiryId(null);
    };

    const openEdit = (section: KnowledgeSection) => {
        setActiveTab('sections');
        setEditingId(section.id);
        setFormTitle(section.title);
        setFormContent(section.content);
        setSaveError(null);
        setShowDiscrepancyModal(false);
        setExpandedId(null);
        setConvertingInquiryId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormTitle('');
        setFormContent('');
        setSaveError(null);
        setShowDiscrepancyModal(false);
        setConvertingInquiryId(null);
    };

    const handleConvertToFaq = (inquiry: InquiryInsightItem) => {
        const draft = generateFaqDraft(inquiry.user_question, inquiry.assistant_reply);
        setConvertingInquiryId(inquiry.id);
        setFormTitle(draft.title);
        setFormContent(draft.draftContent);
        setEditingId('new');
        setActiveTab('sections');
        setExpandedId(null);
        setSaveError(null);
        setShowDiscrepancyModal(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSync = async (silent = false) => {
        if (!churchId || isSyncing) return;
        setIsSyncing(true);
        if (!silent) setSyncStatus('idle');

        try {
            const { data, error } = await supabase.functions.invoke('sync-church-knowledge', {
                body: { churchId },
            });
            if (error) {
                let msg = error.message;
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const body = await (error as any).context?.json?.();
                    if (body?.error) msg = body.error;
                } catch { /* ignore */ }
                throw new Error(msg);
            }
            const now = new Date();
            localStorage.setItem(`kb_last_synced_${churchId}`, now.toISOString());
            setLastSynced(now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }));
            setIsStale(false);
            setSyncStatus('success');
            setSyncMessage(`Synced ${data.chunksProcessed} knowledge chunks successfully.`);
        } catch (err: unknown) {
            setSyncStatus('error');
            setSyncMessage(err instanceof Error ? err.message : 'Sync failed.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 12000);
        }
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !formContent.trim() || !churchId || !profile) return;
        setSaving(true);
        setSaveError(null);
        setShowDiscrepancyModal(false);

        try {
            if (editingId === 'new') {
                const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) + 1 : 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase as any)
                    .from('church_knowledge_sections')
                    .insert({
                        church_id: churchId,
                        title: formTitle.trim(),
                        content: formContent.trim(),
                        display_order: maxOrder,
                        created_by: profile.id,
                    });
                if (error) throw new Error(error.message);

                if (convertingInquiryId) {
                    markAsAddressed(convertingInquiryId);
                    setConvertingInquiryId(null);
                    await refreshChatInsights();
                }
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase as any)
                    .from('church_knowledge_sections')
                    .update({
                        title: formTitle.trim(),
                        content: formContent.trim(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingId);
                if (error) throw new Error(error.message);
            }
            await fetchSections();
            cancelEdit();
            // Auto-sync after saving so AI is always up to date
            await handleSync(true);
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleAttemptSave = () => {
        if (!formTitle.trim() || !formContent.trim() || !churchId || !profile) return;
        if (lintResult.hasWarnings) {
            setShowDiscrepancyModal(true);
        } else {
            handleSave();
        }
    };

    const handleProceedAnyway = async () => {
        setShowDiscrepancyModal(false);
        await handleSave();
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete section "${title}"? This cannot be undone.`)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('church_knowledge_sections').delete().eq('id', id);
        await fetchSections();
        // Auto-sync so deleted content is removed from AI immediately
        await handleSync(true);
    };

    // Polish with AI
    const handlePolishWithAI = async () => {
        if (!formContent.trim() || formContent.trim().length < 10 || isPolishing) return;
        setIsPolishing(true);
        try {
            const result = await polishKnowledgeContent(formTitle, formContent, churchName);
            setPolishedCandidate({
                title: result.polishedTitle,
                content: result.polishedContent,
                trace: result.trace,
            });
            setShowPolishReviewModal(true);
        } catch (err) {
            console.error('Failed to polish content:', err);
        } finally {
            setIsPolishing(false);
        }
    };

    const handleApplyPolishedVersion = () => {
        if (!polishedCandidate) return;
        setFormTitle(polishedCandidate.title);
        setFormContent(polishedCandidate.content);
        setShowPolishReviewModal(false);
        setPolishedCandidate(null);
        setPolishedNotice(true);
        setTimeout(() => setPolishedNotice(false), 4000);
    };

    // Bulk create starter templates
    const handleCreateSelectedTemplates = async () => {
        if (!churchId || !profile || selectedTemplateIds.size === 0 || bulkInserting) return;
        setBulkInserting(true);
        try {
            const templatesToInsert = STARTER_FAQ_TEMPLATES.filter(t => selectedTemplateIds.has(t.id));
            const currentMaxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) : -1;

            const rows = templatesToInsert.map((t, idx) => ({
                church_id: churchId,
                title: t.title,
                content: t.content,
                display_order: currentMaxOrder + 1 + idx,
                created_by: profile.id,
            }));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
                .from('church_knowledge_sections')
                .insert(rows);

            if (error) throw error;

            setShowStarterTemplatesModal(false);
            await fetchSections();
            await handleSync(true);
        } catch (err) {
            console.error('Failed to insert starter templates:', err);
            alert('Failed to insert templates. Please try again.');
        } finally {
            setBulkInserting(false);
        }
    };

    const charCount = (text: string) => {
        if (text.length < 1000) return `${text.length} chars`;
        return `${(text.length / 1000).toFixed(1)}k chars`;
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

    if (!canEdit) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-sm text-muted">Only church admins and super admins can manage the knowledge base.</p>
            </div>
        );
    }

    if (!churchId) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">No Church Assigned</h2>
                <p className="text-sm text-muted">You must be assigned to a church to manage its knowledge base.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-3"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">AI Knowledge Base</h1>
                            <p className="text-sm text-muted">Add or edit content that the AI chatbot will use to answer parishioner questions.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {canEdit && (
                        <>
                            <button
                                onClick={() => setShowStarterTemplatesModal(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm font-medium hover:bg-amber-100 transition-all shadow-xs"
                                title="Browse pre-crafted parish policy templates"
                            >
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                Starter Templates
                            </button>
                            <button
                                onClick={openNew}
                                disabled={editingId !== null}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-100 text-secondary-800 text-sm font-medium hover:bg-secondary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Add Section
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => handleSync()}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                        {isSyncing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <Bot className="w-4 h-4" />
                                Sync AI Knowledge Base
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stale sync warning */}
            {isStale && syncStatus === 'idle' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-amber-700 font-medium">
                            {lastSynced ? `AI knowledge was last synced on ${lastSynced}` : 'AI knowledge has never been synced'}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">We recommend syncing regularly so the AI has the latest information.</p>
                    </div>
                </div>
            )}

            {/* Sync status */}
            {syncStatus === 'success' && (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm text-green-700">{syncMessage}</p>
                        {lastSynced && <p className="text-xs text-green-600 mt-0.5">Last synced at {lastSynced}</p>}
                    </div>
                </div>
            )}
            {syncStatus === 'error' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{syncMessage}</p>
                </div>
            )}

            {/* Top Navigation Tabs */}
            <div className="flex border-b border-secondary-200 gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('sections')}
                    className={`flex items-center gap-2 py-2.5 px-4 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'sections'
                            ? 'border-primary text-primary font-semibold'
                            : 'border-transparent text-secondary-600 hover:text-foreground'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Knowledge Sections</span>
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-700">
                        {sections.length}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('insights')}
                    className={`flex items-center gap-2 py-2.5 px-4 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'insights'
                            ? 'border-primary text-primary font-semibold'
                            : 'border-transparent text-secondary-600 hover:text-foreground'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Inquiry Insights & Gaps</span>
                    {unansweredCount > 0 && (
                        <span
                            data-testid="unanswered-badge"
                            className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"
                        >
                            {unansweredCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab 1: Knowledge Sections CRUD */}
            {activeTab === 'sections' && (
                <div className="space-y-6">
                    {/* New Section Form */}
                    {editingId === 'new' && (
                <div className="bg-white border-2 border-primary/30 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Plus className="w-4 h-4 text-primary" />
                            New Knowledge Section
                        </h2>
                        <div className="flex items-center gap-2 flex-wrap">
                            {polishedNotice && (
                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ✨ Polished with AI!
                                </span>
                            )}
                            <select
                                onChange={(e) => {
                                    const tmpl = STARTER_FAQ_TEMPLATES.find(t => t.id === e.target.value);
                                    if (tmpl) {
                                        setFormTitle(tmpl.title);
                                        setFormContent(tmpl.content);
                                    }
                                    e.target.value = '';
                                }}
                                defaultValue=""
                                className="text-xs border border-secondary-200 rounded-lg px-2.5 py-1.5 bg-white text-secondary-700 hover:bg-secondary-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                title="Load a pre-crafted template"
                            >
                                <option value="" disabled>✨ Insert Template...</option>
                                {STARTER_FAQ_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handlePolishWithAI}
                                disabled={isPolishing || formContent.trim().length < 10}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                                title={formContent.trim().length < 10 ? 'Type at least 10 characters to polish' : 'Polish draft with AI Scribe'}
                            >
                                {isPolishing ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                                        <span>Polishing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                        <span>✨ Polish with AI</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Section title (e.g. Parish History, FAQs, Office Hours)"
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        className="input w-full"
                        autoFocus
                    />
                    <textarea
                        placeholder="Paste or type your church information here. The AI will learn from this content when you click Sync."
                        value={formContent}
                        onChange={e => setFormContent(e.target.value)}
                        rows={12}
                        className="input w-full resize-y min-h-[200px] pt-2 font-mono text-sm leading-relaxed"
                    />

                    {/* Pre-Save Discrepancy Linter Warning Box */}
                    {lintResult.hasWarnings && (
                        <div
                            data-testid="knowledge-lint-warning"
                            className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 space-y-2 text-sm transition-all"
                        >
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-1.5 flex-1">
                                    <p className="font-semibold text-amber-900 text-sm leading-snug">
                                        ⚠️ Hardcoded Mass schedule or fee detected. Mass schedules and fees are managed dynamically in the Liturgy & Services tabs so they stay synchronized with live bookings and the AI assistant.
                                    </p>
                                    <div className="pt-1 space-y-1">
                                        {lintResult.issues.map((issue, idx) => (
                                            <div key={idx} className="text-xs text-amber-800 flex items-start gap-1.5 flex-wrap">
                                                <span className="font-mono font-medium bg-amber-100/90 border border-amber-300/70 px-1.5 py-0.5 rounded text-amber-900 shrink-0">
                                                    "{issue.matchedText}"
                                                </span>
                                                <span className="text-amber-800">
                                                    — {issue.suggestion}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted">{charCount(formContent)}</p>
                        <div className="flex items-center gap-2">
                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-100 transition-colors">
                                <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                                onClick={handleAttemptSave}
                                disabled={saving || !formTitle.trim() || !formContent.trim()}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Save Section'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sections List */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted">Loading knowledge base...</p>
                </div>
            ) : sections.length === 0 && editingId !== 'new' ? (
                <div className="text-center py-16 bg-secondary-50 rounded-2xl border border-dashed border-border p-6 space-y-4">
                    <BookOpen className="w-10 h-10 text-muted mx-auto mb-1 opacity-50" />
                    <div>
                        <p className="text-sm font-medium text-foreground mb-1">No knowledge sections yet</p>
                        <p className="text-xs text-muted max-w-md mx-auto">
                            Add policies or choose from pre-crafted Catholic parish templates so the AI knows how to answer parishioner questions.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-100 text-secondary-800 text-sm font-medium hover:bg-secondary-200 transition-all">
                            <Plus className="w-4 h-4" />
                            Add First Section
                        </button>
                        <button
                            onClick={() => setShowStarterTemplatesModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-all shadow-xs"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate Starter FAQs
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {sections.map((section) => (
                        <div key={section.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-2xs hover:border-primary/30 transition-colors">
                            {editingId === section.id ? (
                                /* Edit Mode */
                                <div className="p-5 space-y-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            <Pencil className="w-4 h-4 text-primary" />
                                            Editing Section
                                        </h2>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {polishedNotice && (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                    ✨ Polished with AI!
                                                </span>
                                            )}
                                            <select
                                                onChange={(e) => {
                                                    const tmpl = STARTER_FAQ_TEMPLATES.find(t => t.id === e.target.value);
                                                    if (tmpl) {
                                                        setFormTitle(tmpl.title);
                                                        setFormContent(tmpl.content);
                                                    }
                                                    e.target.value = '';
                                                }}
                                                defaultValue=""
                                                className="text-xs border border-secondary-200 rounded-lg px-2.5 py-1.5 bg-white text-secondary-700 hover:bg-secondary-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                                title="Load a pre-crafted template"
                                            >
                                                <option value="" disabled>✨ Insert Template...</option>
                                                {STARTER_FAQ_TEMPLATES.map(t => (
                                                    <option key={t.id} value={t.id}>{t.title}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handlePolishWithAI}
                                                disabled={isPolishing || formContent.trim().length < 10}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                                                title={formContent.trim().length < 10 ? 'Type at least 10 characters to polish' : 'Polish draft with AI Scribe'}
                                            >
                                                {isPolishing ? (
                                                    <>
                                                        <div className="w-3 h-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                                                        <span>Polishing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                                        <span>✨ Polish with AI</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Scribe Active Loading Banner */}
                                    {isPolishing && (
                                        <div
                                            data-testid="ai-scribe-loading-banner"
                                            className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 shadow-2xs animate-pulse"
                                        >
                                            <div className="w-4 h-4 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin shrink-0" />
                                            <span className="text-xs font-semibold tracking-tight">
                                                ✨ Analyzing pastoral tone &amp; drafting guidelines with Gemini...
                                            </span>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        value={formTitle}
                                        onChange={e => setFormTitle(e.target.value)}
                                        className="input w-full"
                                        autoFocus
                                    />
                                    <textarea
                                        value={formContent}
                                        onChange={e => setFormContent(e.target.value)}
                                        rows={14}
                                        className="input w-full resize-y min-h-[250px] pt-2 font-mono text-sm leading-relaxed"
                                    />

                                    {/* Pre-Save Discrepancy Linter Warning Box */}
                                    {lintResult.hasWarnings && (
                                        <div
                                            data-testid="knowledge-lint-warning"
                                            className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 space-y-2 text-sm transition-all"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div className="space-y-1.5 flex-1">
                                                    <p className="font-semibold text-amber-900 text-sm leading-snug">
                                                        ⚠️ Hardcoded Mass schedule or fee detected. Mass schedules and fees are managed dynamically in the Liturgy & Services tabs so they stay synchronized with live bookings and the AI assistant.
                                                    </p>
                                                    <div className="pt-1 space-y-1">
                                                        {lintResult.issues.map((issue, idx) => (
                                                            <div key={idx} className="text-xs text-amber-800 flex items-start gap-1.5 flex-wrap">
                                                                <span className="font-mono font-medium bg-amber-100/90 border border-amber-300/70 px-1.5 py-0.5 rounded text-amber-900 shrink-0">
                                                                    "{issue.matchedText}"
                                                                </span>
                                                                <span className="text-amber-800">
                                                                    — {issue.suggestion}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <p className="text-xs text-muted">{charCount(formContent)}</p>
                                        <div className="flex items-center gap-2">
                                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                                            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-100 transition-colors">
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleAttemptSave}
                                                disabled={saving || !formTitle.trim() || !formContent.trim()}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                                            >
                                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                                {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <>
                                    <div
                                        className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-secondary-50 transition-colors"
                                        onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <BookOpen className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{section.title}</p>
                                                <p className="text-xs text-muted">
                                                    {charCount(section.content)} · Updated {formatDate(section.updated_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {canEdit && (
                                                <>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); openEdit(section); }}
                                                        className="p-1.5 text-secondary-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Edit section"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleDelete(section.id, section.title); }}
                                                        className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete section"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                            {expandedId === section.id
                                                ? <ChevronUp className="w-4 h-4 text-muted" />
                                                : <ChevronDown className="w-4 h-4 text-muted" />
                                            }
                                        </div>
                                    </div>

                                    {/* Expanded Content Preview */}
                                    {expandedId === section.id && (
                                        <div className="border-t border-secondary-100 px-4 py-4 bg-secondary-50/50">
                                            <pre className="text-xs text-secondary-700 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto scrollbar-thin">
                                                {section.content}
                                            </pre>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Footer tip */}
            {sections.length > 0 && syncStatus === 'idle' && !isStale && (
                <p className="text-xs text-muted text-center pb-2">
                    After making changes, the AI syncs automatically. You can also click <strong>Sync AI Knowledge Base</strong> manually.
                </p>
            )}
                </div>
            )}

            {/* Tab 2: Inquiry Insights & Gaps Dashboard */}
            {activeTab === 'insights' && (
                <div className="space-y-6">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Total Inquiries */}
                        <div className="bg-white border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Total Inquiries</p>
                                <p className="text-2xl font-bold text-foreground mt-1">{totalInquiries}</p>
                                <p className="text-xs text-muted mt-0.5">Past 30 days of parishioner chats</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-6 h-6 text-primary" />
                            </div>
                        </div>

                        {/* Unanswered / Low Confidence Questions */}
                        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-2xs flex items-center justify-between bg-amber-50/20">
                            <div>
                                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Unanswered Questions</p>
                                <p className="text-2xl font-bold text-amber-950 mt-1">{unansweredCount}</p>
                                <p className="text-xs text-amber-700 mt-0.5">Require parish FAQ documentation</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-amber-600" />
                            </div>
                        </div>

                        {/* Documented Topics */}
                        <div className="bg-white border border-border rounded-2xl p-5 shadow-2xs flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Documented Topics</p>
                                <p className="text-2xl font-bold text-foreground mt-1">{sections.length}</p>
                                <p className="text-xs text-muted mt-0.5">Active knowledge base sections</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center shrink-0">
                                <BookOpen className="w-6 h-6 text-secondary-600" />
                            </div>
                        </div>
                    </div>

                    {/* Section Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                Unanswered Questions
                            </h2>
                            <p className="text-xs text-muted mt-0.5">
                                Parishioner questions where the AI assistant had low confidence or advised contacting the parish office. Convert inquiries to FAQ sections to fill knowledge gaps.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => refreshChatInsights()}
                            disabled={insightsLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-secondary-700 hover:bg-secondary-100 border border-secondary-200 transition-colors"
                            title="Refresh chat insights"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {/* Inquiries List */}
                    {insightsLoading ? (
                        <div className="text-center py-16">
                            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-sm text-muted">Analyzing chat logs and inquiries...</p>
                        </div>
                    ) : recentUnanswered.length === 0 ? (
                        <div className="text-center py-16 bg-emerald-50/40 rounded-2xl border border-dashed border-emerald-200 p-6 space-y-3">
                            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">No Unanswered Inquiries Found</p>
                                <p className="text-xs text-muted max-w-md mx-auto mt-1">
                                    All inquiries in the past 30 days were answered with confidence, or no low-confidence inquiries have been recorded yet.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentUnanswered.map((item) => (
                                <div
                                    key={item.id}
                                    className={`bg-white border rounded-2xl p-4 shadow-2xs space-y-3 transition-colors ${
                                        item.status === 'unanswered' ? 'border-amber-200/80 hover:border-amber-300' : 'border-border opacity-75'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-muted font-medium">
                                                {formatDate(item.created_at)}
                                            </span>
                                            {item.status === 'unanswered' ? (
                                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                                    Unanswered
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Addressed
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleConvertToFaq(item)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 shadow-2xs transition-all"
                                                title="Convert inquiry to knowledge base section"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                <span>✨ Convert to FAQ</span>
                                            </button>
                                            {item.status === 'unanswered' && (
                                                <button
                                                    type="button"
                                                    onClick={() => markAsAddressed(item.id)}
                                                    className="px-2.5 py-1.5 text-xs font-medium text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
                                                    title="Mark as addressed"
                                                >
                                                    Dismiss
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Question */}
                                    <div>
                                        <p className="text-xs text-muted font-medium uppercase tracking-wider mb-0.5">Parishioner Question:</p>
                                        <p className="text-sm font-semibold text-foreground">
                                            "{item.user_question}"
                                        </p>
                                    </div>

                                    {/* Assistant response snippet */}
                                    <div className="bg-secondary-50/70 border border-secondary-200/60 rounded-lg p-3">
                                        <p className="text-xs text-muted font-medium mb-1">Assistant Response Snippet:</p>
                                        <p className="text-xs text-secondary-700 italic leading-relaxed">
                                            "{item.assistant_reply}"
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Discrepancy Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDiscrepancyModal}
                title="Discrepancy Warning"
                message="This section contains hardcoded schedules or fees that may become outdated when official parish schedules change. Do you want to review your changes or proceed anyway?"
                confirmLabel="Proceed Anyway"
                cancelLabel="Review & Edit"
                variant="warning"
                loading={saving}
                onConfirm={handleProceedAnyway}
                onCancel={() => setShowDiscrepancyModal(false)}
            />

            {/* Review & Apply AI Polish Modal */}
            <Modal
                isOpen={showPolishReviewModal && !!polishedCandidate}
                onClose={() => {
                    setShowPolishReviewModal(false);
                    setPolishedCandidate(null);
                }}
                title={
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Review Polished Pastoral Guidelines</h3>
                            <p className="text-xs text-muted">Review the AI Scribe transformation before applying it to your section editor.</p>
                        </div>
                    </div>
                }
                size="4xl"
                showCloseButton={true}
                footer={
                    <div className="flex items-center justify-between gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => {
                                setShowPolishReviewModal(false);
                                setPolishedCandidate(null);
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 transition-colors"
                        >
                            Revert / Keep Original
                        </button>
                        <button
                            type="button"
                            onClick={handleApplyPolishedVersion}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 shadow-sm transition-all"
                        >
                            <Check className="w-4 h-4" />
                            Apply Polished Version
                        </button>
                    </div>
                }
            >
                {polishedCandidate && (
                    <div className="p-1 space-y-4 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Original Draft */}
                            <div className="flex flex-col border border-border rounded-2xl overflow-hidden bg-secondary-50/40">
                                <div className="px-4 py-2.5 bg-secondary-100/70 border-b border-border flex items-center justify-between">
                                    <span className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Original Draft</span>
                                    <span className="text-[11px] text-muted">{formContent.length} chars</span>
                                </div>
                                <div className="p-4 flex-1 overflow-y-auto max-h-80 space-y-2">
                                    <p className="text-xs font-bold text-foreground">{formTitle || '(Untitled Draft)'}</p>
                                    <pre className="text-xs text-secondary-700 whitespace-pre-wrap font-sans leading-relaxed">
                                        {formContent}
                                    </pre>
                                </div>
                            </div>

                            {/* Polished Pastoral Version */}
                            <div className="flex flex-col border-2 border-amber-300 rounded-2xl overflow-hidden bg-amber-50/20 shadow-xs">
                                <div className="px-4 py-2.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                        Polished Pastoral Version
                                    </span>
                                    <span className="text-[11px] text-amber-800">{polishedCandidate.content.length} chars</span>
                                </div>
                                <div className="p-4 flex-1 overflow-y-auto max-h-80 space-y-2">
                                    <p className="text-xs font-bold text-amber-950">{polishedCandidate.title}</p>
                                    <pre className="text-xs text-secondary-800 whitespace-pre-wrap font-sans leading-relaxed">
                                        {polishedCandidate.content}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* AI Trace Panel */}
                        {polishedCandidate.trace && (
                            <div
                                data-testid="ai-scribe-trace-panel"
                                className="bg-secondary-50 border border-secondary-200/80 rounded-xl p-3 text-xs text-secondary-700 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
                            >
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold text-[11px] border border-amber-300">
                                        <Sparkles className="w-3 h-3 text-amber-600" />
                                        AI Trace: {polishedCandidate.trace.model}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-secondary-200 font-medium text-[11px] text-secondary-600">
                                        {polishedCandidate.trace.durationMs}ms
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-secondary-200 font-medium text-[11px] text-secondary-600">
                                        {polishedCandidate.trace.rawWordCount} words → {polishedCandidate.trace.polishedWordCount} words
                                    </span>
                                </div>
                                <div className="text-[11px] text-secondary-500 font-medium truncate">
                                    {polishedCandidate.trace.analysis}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Starter FAQ Templates Modal */}
            <Modal
                isOpen={showStarterTemplatesModal}
                onClose={() => setShowStarterTemplatesModal(false)}
                title={
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Starter FAQ & Policy Templates</h3>
                            <p className="text-xs text-muted">Select standard Philippine Catholic parish policies to quickly populate your AI knowledge base.</p>
                        </div>
                    </div>
                }
                size="3xl"
                showCloseButton={true}
                footer={
                    <div className="flex items-center justify-between gap-3 w-full">
                        <button
                            type="button"
                            onClick={() => setShowStarterTemplatesModal(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateSelectedTemplates}
                            disabled={selectedTemplateIds.size === 0 || bulkInserting}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            {bulkInserting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creating Sections...</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    <span>Create Selected Sections ({selectedTemplateIds.size})</span>
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* Quick Select Actions */}
                    <div className="flex items-center justify-between p-2.5 bg-secondary-50 border border-secondary-200 rounded-lg text-xs">
                        <span className="text-secondary-600 font-medium">
                            {selectedTemplateIds.size} of {STARTER_FAQ_TEMPLATES.length} templates selected
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedTemplateIds(new Set(STARTER_FAQ_TEMPLATES.map(t => t.id)))}
                                className="text-primary hover:underline font-semibold"
                            >
                                Select All
                            </button>
                            <span className="text-secondary-300">|</span>
                            <button
                                type="button"
                                onClick={() => setSelectedTemplateIds(new Set())}
                                className="text-secondary-600 hover:underline font-semibold"
                            >
                                Deselect All
                            </button>
                        </div>
                    </div>

                    {/* Templates List */}
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {STARTER_FAQ_TEMPLATES.map((tmpl) => {
                            const isSelected = selectedTemplateIds.has(tmpl.id);
                            const isExpanded = previewingTemplateId === tmpl.id;

                            return (
                                <div
                                    key={tmpl.id}
                                    className={`border rounded-2xl p-4 transition-all shadow-2xs ${
                                        isSelected ? 'border-primary/40 bg-primary/[0.02]' : 'border-border bg-white'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <label className="flex items-start gap-3 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    const next = new Set(selectedTemplateIds);
                                                    if (e.target.checked) next.add(tmpl.id);
                                                    else next.delete(tmpl.id);
                                                    setSelectedTemplateIds(next);
                                                }}
                                                className="mt-1 h-4 w-4 rounded border-secondary-300 text-primary focus:ring-primary"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-foreground">{tmpl.title}</span>
                                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700">
                                                        {tmpl.category}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted mt-1 line-clamp-2">
                                                    {tmpl.content.slice(0, 150)}...
                                                </p>
                                            </div>
                                        </label>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {editingId !== null && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormTitle(tmpl.title);
                                                        setFormContent(tmpl.content);
                                                        setShowStarterTemplatesModal(false);
                                                    }}
                                                    className="text-xs px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-700 hover:bg-secondary-200 font-medium transition-colors"
                                                >
                                                    Load into Editor
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setPreviewingTemplateId(isExpanded ? null : tmpl.id)}
                                                className="p-1 text-secondary-400 hover:text-secondary-600 rounded transition-colors"
                                                title={isExpanded ? 'Collapse preview' : 'Expand full preview'}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Collapsible Full Markdown Preview */}
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-secondary-100">
                                            <pre className="text-xs text-secondary-700 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto bg-secondary-50/60 p-3 rounded-lg">
                                                {tmpl.content}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
