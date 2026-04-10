import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp, ArrowLeft, AlertCircle, CheckCircle, XCircle, Bot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

    const churchId = (profile as any)?.church_id ?? (profile as any)?.assigned_church_id ?? null;
    const canEdit = profile?.role === 'super_admin' || profile?.role === 'church_admin' || profile?.role === 'admin';

    const [sections, setSections] = useState<KnowledgeSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // New / Edit form state
    const [editingId, setEditingId] = useState<string | 'new' | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    const fetchSections = async () => {
        if (!churchId) return;
        const { data, error } = await (supabase as any)
            .from('church_knowledge_sections')
            .select('id, title, content, display_order, updated_at')
            .eq('church_id', churchId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (!error && data) setSections(data as KnowledgeSection[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [churchId]);

    const openNew = () => {
        setEditingId('new');
        setFormTitle('');
        setFormContent('');
        setSaveError(null);
        setExpandedId(null);
    };

    const openEdit = (section: KnowledgeSection) => {
        setEditingId(section.id);
        setFormTitle(section.title);
        setFormContent(section.content);
        setSaveError(null);
        setExpandedId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormTitle('');
        setFormContent('');
        setSaveError(null);
    };

    const handleSave = async () => {
        if (!formTitle.trim() || !formContent.trim() || !churchId || !profile) return;
        setSaving(true);
        setSaveError(null);

        try {
            if (editingId === 'new') {
                const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) + 1 : 0;
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
            } else {
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
        } catch (err: any) {
            setSaveError(err.message || 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete section "${title}"? This cannot be undone. Remember to re-sync the AI after deleting.`)) return;
        await (supabase as any).from('church_knowledge_sections').delete().eq('id', id);
        await fetchSections();
    };

    const handleSync = async () => {
        if (!churchId || isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');

        try {
            const { data, error } = await supabase.functions.invoke('sync-church-knowledge', {
                body: { churchId },
            });
            if (error) {
                let msg = error.message;
                try {
                    const body = await (error as any).context?.json?.();
                    if (body?.error) msg = body.error;
                } catch { /* ignore */ }
                throw new Error(msg);
            }
            setSyncStatus('success');
            setSyncMessage(`Synced ${data.chunksProcessed} knowledge chunks successfully.`);
            setLastSynced(new Date().toLocaleTimeString());
        } catch (err: any) {
            setSyncStatus('error');
            setSyncMessage(err.message || 'Sync failed.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 12000);
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
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 animate-in">

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
                        <button
                            onClick={openNew}
                            disabled={editingId !== null}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-100 text-secondary-800 text-sm font-medium hover:bg-secondary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Add Section
                        </button>
                    )}
                    <button
                        onClick={handleSync}
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

            {/* New Section Form */}
            {editingId === 'new' && (
                <div className="bg-white border-2 border-primary/30 rounded-xl p-5 shadow-sm space-y-4">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" />
                        New Knowledge Section
                    </h2>
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
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted">{charCount(formContent)}</p>
                        <div className="flex items-center gap-2">
                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-100 transition-colors">
                                <X className="w-4 h-4" /> Cancel
                            </button>
                            <button
                                onClick={handleSave}
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
                <div className="text-center py-16 bg-secondary-50 rounded-xl border border-dashed border-secondary-200">
                    <BookOpen className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-foreground mb-1">No knowledge sections yet</p>
                    <p className="text-xs text-muted mb-4">Add your first section to teach the AI about your parish.</p>
                    <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all mx-auto">
                        <Plus className="w-4 h-4" />
                        Add First Section
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sections.map((section) => (
                        <div key={section.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:border-primary/30 transition-colors">
                            {editingId === section.id ? (
                                /* Edit Mode */
                                <div className="p-5 space-y-4">
                                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                        <Pencil className="w-4 h-4 text-primary" />
                                        Editing Section
                                    </h2>
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
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <p className="text-xs text-muted">{charCount(formContent)}</p>
                                        <div className="flex items-center gap-2">
                                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                                            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-secondary-600 hover:bg-secondary-100 transition-colors">
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
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
            {sections.length > 0 && syncStatus === 'idle' && (
                <p className="text-xs text-muted text-center pb-2">
                    After making changes, click <strong>Sync AI Knowledge Base</strong> to update what the chatbot knows.
                </p>
            )}
        </div>
    );
}
