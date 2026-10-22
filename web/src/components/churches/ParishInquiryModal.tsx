import React, { useEffect, useState } from 'react';
import { Church as ChurchIcon, Send, AlertCircle, Building2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { churchHasAdmin, submitParishOfficeInquiry, type TicketLane } from '../../lib/supabase/messaging';

export interface ParishInquiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-selected parish. When omitted the sender picks one from `parishOptions`. */
    churchId?: string | null;
    churchName?: string;
    churchImage?: string | null;
    /** Parishes offered in the selector when no `churchId` is pre-selected. */
    parishOptions?: Array<{ id: string; name: string }>;
    /** Parish preselected in the selector (the sender's home or assigned parish). */
    defaultChurchId?: string | null;
    userId: string;
    /** Role of the sender; decides which platform categories are offered. Defaults to a Parishioner. */
    role?: string;
    /** Which desk the ticket goes to: the parish office or the Super Admin. */
    lane?: TicketLane;
    /** A Volunteer chooses between the parish office and the Super Admin at the top of the form. */
    allowLaneChoice?: boolean;
    onSuccess: (conversationId: string) => void;
}

export interface InquiryCategoryOption {
    id: string;
    label: string;
    emoji: string;
    description: string;
}

export const INQUIRY_CATEGORIES: InquiryCategoryOption[] = [
    { id: 'baptism', label: 'Baptism', emoji: '🕊️', description: 'Baptismal certificates, scheduling & requirements' },
    { id: 'wedding', label: 'Wedding', emoji: '💍', description: 'Matrimony banns, schedules & pre-cana interview' },
    { id: 'funeral', label: 'Funeral & Blessing', emoji: '🕯️', description: 'Funeral mass, house or vehicle blessings' },
    { id: 'mass_intention', label: 'Mass Intention', emoji: '🙏', description: 'Thanksgiving mass, eternal repose, special prayer' },
    { id: 'certificate', label: 'Certificate Request', emoji: '📜', description: 'Confirmation, marriage, or sacramental record copy' },
    { id: 'general', label: 'General Question', emoji: '💬', description: 'Parish office inquiries, priest availability & events' },
];

/** Platform-lane categories per role (spec decision 28); the database enforces the same lists. */
const REPORT_CHURCH_CATEGORY: InquiryCategoryOption = {
    id: 'report_church',
    label: 'Report a concern about my church',
    emoji: '🚩',
    description: 'Goes straight to the Super Admin. Your church administrator will not see it',
};

const PLATFORM_GENERAL: InquiryCategoryOption = { id: 'general', label: 'General Question', emoji: '💬', description: 'Any question for the Super Admin' };
const PLATFORM_PROBLEM: InquiryCategoryOption = { id: 'report_problem', label: 'Report a problem', emoji: '🛠️', description: 'Something in Sacralink is not working' };
const PLATFORM_PERSON: InquiryCategoryOption = { id: 'report_person', label: 'Report a person or abuse', emoji: '⚠️', description: 'Report a person or abusive behaviour' };
const PLATFORM_SETUP: InquiryCategoryOption = { id: 'church_setup', label: 'Church verification and setup', emoji: '⛪', description: 'Verify your church or finish its setup' };

function platformCategoriesForRole(role: string): InquiryCategoryOption[] {
    if (role === 'church_admin') return [PLATFORM_GENERAL, PLATFORM_SETUP, PLATFORM_PROBLEM, PLATFORM_PERSON];
    if (role === 'priest' || role === 'volunteer') return [PLATFORM_GENERAL, PLATFORM_PROBLEM, PLATFORM_PERSON];
    return [REPORT_CHURCH_CATEGORY];
}

export default function ParishInquiryModal({
    isOpen,
    onClose,
    churchId,
    churchName,
    churchImage,
    parishOptions = [],
    defaultChurchId,
    userId,
    role = 'user',
    lane: initialLane = 'church',
    allowLaneChoice = false,
    onSuccess,
}: ParishInquiryModalProps) {
    const [lane, setLane] = useState<TicketLane>(initialLane);
    const isParishioner = role === 'user';
    // Church staff write to the Super Admin about their own church; Parishioners pick the church they are reporting
    const needsParishSelector = lane === 'platform' ? isParishioner : !churchId;
    const [selectedChurchId, setSelectedChurchId] = useState<string>(defaultChurchId || '');
    const activeChurchId =
        lane === 'platform' && !isParishioner
            ? defaultChurchId || ''
            : (lane === 'church' ? churchId : null) || selectedChurchId || (parishOptions.length === 1 ? parishOptions[0].id : '');
    const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
    const activeChurchName =
        churchName || parishOptions.find((p) => p.id === activeChurchId)?.name || 'Select a parish';
    const categories = lane === 'platform' ? platformCategoriesForRole(role) : INQUIRY_CATEGORIES;
    const [category, setCategory] = useState(lane === 'platform' && isParishioner ? REPORT_CHURCH_CATEGORY.id : 'general');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // A Parishioner whose chosen church has no Church Admin can only report a concern about it
    useEffect(() => {
        if (!isParishioner || lane !== 'church' || !activeChurchId) {
            setHasAdmin(null);
            return;
        }
        let cancelled = false;
        churchHasAdmin(activeChurchId).then((ok) => {
            if (!cancelled) setHasAdmin(ok);
        });
        return () => {
            cancelled = true;
        };
    }, [isParishioner, lane, activeChurchId]);

    const chooseLane = (next: TicketLane) => {
        setLane(next);
        setError(null);
        setCategory(next === 'platform' && isParishioner ? REPORT_CHURCH_CATEGORY.id : 'general');
    };

    const isSubjectValid = subject.trim().length >= 3;
    const isMessageValid = message.trim().length >= 10;
    const isFormValid = isSubjectValid && isMessageValid && Boolean(activeChurchId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || loading) return;

        setLoading(true);
        setError(null);

        try {
            const { conversationId, error: submitErr } = await submitParishOfficeInquiry({
                churchId: activeChurchId,
                userId,
                subject: subject.trim(),
                message: message.trim(),
                category,
                lane,
                churchName: activeChurchName === 'Select a parish' ? undefined : activeChurchName,
            });

            if (submitErr || !conversationId) {
                throw submitErr || new Error('Could not create inquiry ticket');
            }

            // Reset state and notify parent
            setSubject('');
            setMessage('');
            setCategory(lane === 'platform' && isParishioner ? REPORT_CHURCH_CATEGORY.id : 'general');
            onSuccess(conversationId);
        } catch (err: unknown) {
            console.error('Error submitting inquiry modal:', err);
            const msg = err instanceof Error ? err.message : 'Failed to send inquiry to parish office. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setError(null);
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            size="lg"
            showCloseButton={!loading}
            header={
                <div className="flex items-center gap-3.5 p-4 sm:p-6 border-b border-border bg-slate-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-border shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                        {churchImage ? (
                            <img src={churchImage} alt={activeChurchName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-blue-50/80 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-primary" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                                {lane === 'platform' ? 'Sacralink Platform Desk' : 'Parish Office Online Desk'}
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                            {lane === 'platform' && !isParishioner
                                ? 'Contact the Super Admin'
                                : lane === 'platform'
                                  ? 'Report a concern about my church'
                                  : 'Contact Parish Office'}
                        </h2>
                        <p className="text-xs text-muted truncate mt-0.5">
                            {activeChurchName}
                        </p>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {allowLaneChoice && (
                    <div className="space-y-1.5">
                        <span className="block text-xs font-bold text-foreground">Send to</span>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                ['church', 'Parish office'],
                                ['platform', 'Super Admin'],
                            ] as Array<[TicketLane, string]>).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => chooseLane(value)}
                                    disabled={loading}
                                    aria-pressed={lane === value}
                                    className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                        lane === value
                                            ? 'bg-blue-50/80 border-primary text-primary ring-1 ring-primary/20'
                                            : 'bg-white border-border text-foreground hover:bg-secondary-50'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {needsParishSelector && (
                    <div className="space-y-1.5">
                        <label htmlFor="inquiry-parish" className="block text-xs font-bold text-foreground">
                            {lane === 'platform' ? 'Church the concern is about' : 'Parish'} <span className="text-destructive">*</span>
                        </label>
                        <select
                            id="inquiry-parish"
                            value={activeChurchId}
                            onChange={(e) => setSelectedChurchId(e.target.value)}
                            disabled={loading}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-60 cursor-pointer"
                        >
                            <option value="">{lane === 'platform' ? 'Choose the church' : 'Choose the parish office to contact'}</option>
                            {parishOptions.map((parish) => (
                                <option key={parish.id} value={parish.id}>
                                    {parish.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {isParishioner && lane === 'church' && hasAdmin === false && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                        This church has no administrator yet. You can report a concern about the church instead.
                    </div>
                )}
                {isParishioner && lane === 'church' && activeChurchId && (
                    <button
                        type="button"
                        onClick={() => chooseLane('platform')}
                        disabled={loading}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                        Report a concern about my church
                    </button>
                )}
                {isParishioner && lane === 'platform' && !allowLaneChoice && (
                    <button
                        type="button"
                        onClick={() => chooseLane('church')}
                        disabled={loading}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                        Back to contacting the parish office
                    </button>
                )}

                {/* Ticket Category Selector */}
                <div className="space-y-2" hidden={isParishioner && lane === 'church' && hasAdmin === false}>
                    <label className="block text-xs font-bold text-foreground">
                        Inquiry Category <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {categories.map((cat) => {
                            const isSelected = category === cat.id;
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    disabled={loading}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-blue-50/80 border-primary text-primary font-bold shadow-2xs ring-1 ring-primary/20'
                                            : 'bg-white border-border text-foreground hover:bg-secondary-50 hover:border-secondary-300'
                                    }`}
                                >
                                    <span className="text-base shrink-0">{cat.emoji}</span>
                                    <span className="text-xs truncate">{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-muted">
                        {categories.find((c) => c.id === category)?.description}
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="inquiry-subject" className="block text-xs font-bold text-foreground">
                        Subject <span className="text-destructive">*</span>
                    </label>
                    <input
                        id="inquiry-subject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g., Baptism Schedule Inquiry, Mass Offering, Parish Certificate"
                        disabled={loading}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs sm:text-sm bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-60"
                    />
                    <p className="text-[11px] text-muted">
                        Minimum 3 characters ({subject.trim().length}/3)
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="inquiry-message" className="block text-xs font-bold text-foreground">
                        Message <span className="text-destructive">*</span>
                    </label>
                    <textarea
                        id="inquiry-message"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Please write your detailed inquiry or question for the parish administrative staff..."
                        disabled={loading}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-xs sm:text-sm bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none disabled:opacity-60"
                    />
                    <p className="text-[11px] text-muted">
                        Minimum 10 characters ({message.trim().length}/10)
                    </p>
                </div>

                <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 flex items-start gap-2.5 text-xs text-secondary-700">
                    <ChurchIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold text-foreground">Direct Desk Dispatch:</span> A new ticket conversation will be opened in your Messages inbox. Your inquiry will be forwarded directly to all active parish clergy and administrators.
                    </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-secondary-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isFormValid || loading || (isParishioner && lane === 'church' && hasAdmin === false)}
                        className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                                <span>Sending inquiry...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                <span>Send Inquiry</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
