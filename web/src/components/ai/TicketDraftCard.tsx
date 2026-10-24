import { Mail, Church, Send, X, AlertCircle, Loader2 } from 'lucide-react';

export interface TicketDraftData {
  churchId: string;
  churchName: string;
  category: string;
  subject: string;
  message: string;
}

const TICKET_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'baptism', label: 'Baptism' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'funeral', label: 'Funeral' },
  { value: 'mass_intention', label: 'Mass Intention' },
  { value: 'certificate', label: 'Sacramental Certificate' },
];

interface TicketDraftCardProps {
  draft: TicketDraftData;
  isSubmitting: boolean;
  isLargeText?: boolean;
  onUpdateDraft: (updates: Partial<TicketDraftData>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TicketDraftCard({
  draft,
  isSubmitting,
  isLargeText = false,
  onUpdateDraft,
  onConfirm,
  onCancel,
}: TicketDraftCardProps) {
  const isSubjectValid = draft.subject.trim().length >= 3;
  const isMessageValid = draft.message.trim().length >= 10;
  const isValid = isSubjectValid && isMessageValid;

  return (
    <div
      data-testid="ticket-draft-card"
      className="card bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3.5 text-foreground my-2"
    >
      <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className={`${isLargeText ? 'w-8 h-8' : 'w-7 h-7'} rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs`}>
            <Mail className={isLargeText ? 'w-5 h-5' : 'w-4 h-4'} />
          </div>
          <div>
            <h4 className={`${isLargeText ? 'text-xs sm:text-sm' : 'text-xs'} font-bold uppercase tracking-wider text-muted`}>
              Parish Office Ticket Draft
            </h4>
            <div className={`flex items-center gap-1.5 ${isLargeText ? 'text-sm sm:text-base font-semibold' : 'text-xs font-semibold'} text-foreground`}>
              <Church className={`${isLargeText ? 'w-4 h-4' : 'w-3 h-3'} text-primary`} />
              <span>{draft.churchName || 'Selected Parish'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`space-y-3 ${isLargeText ? 'text-sm sm:text-base' : 'text-xs'}`}>
        {/* Category */}
        <div className="space-y-1">
          <label
            htmlFor="ticket-category"
            className={`${isLargeText ? 'text-xs sm:text-sm' : 'text-[11px]'} font-semibold text-muted uppercase tracking-wider block`}
          >
            Category
          </label>
          <select
            id="ticket-category"
            data-testid="ticket-draft-category"
            value={draft.category}
            onChange={(e) => onUpdateDraft({ category: e.target.value })}
            disabled={isSubmitting}
            className={`w-full bg-white border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer disabled:opacity-50 ${
              isLargeText ? 'text-base py-3 px-3.5' : 'text-xs'
            }`}
          >
            {TICKET_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label
            htmlFor="ticket-subject"
            className={`${isLargeText ? 'text-xs sm:text-sm' : 'text-[11px]'} font-semibold text-muted uppercase tracking-wider block`}
          >
            Subject
          </label>
          <input
            id="ticket-subject"
            data-testid="ticket-draft-subject"
            type="text"
            value={draft.subject}
            onChange={(e) => onUpdateDraft({ subject: e.target.value })}
            placeholder="Subject of your inquiry (min. 3 characters)"
            disabled={isSubmitting}
            className={`w-full bg-white border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 ${
              isLargeText ? 'text-base py-3 px-3.5' : 'text-xs'
            }`}
          />
          {!isSubjectValid && draft.subject.length > 0 && (
            <p className={`${isLargeText ? 'text-xs' : 'text-[10px]'} text-destructive flex items-center gap-1`}>
              <AlertCircle className={`${isLargeText ? 'w-4 h-4' : 'w-3 h-3'}`} />
              <span>Subject must be at least 3 characters.</span>
            </p>
          )}
        </div>

        {/* Message */}
        <div className="space-y-1">
          <label
            htmlFor="ticket-message"
            className={`${isLargeText ? 'text-xs sm:text-sm' : 'text-[11px]'} font-semibold text-muted uppercase tracking-wider block`}
          >
            Message
          </label>
          <textarea
            id="ticket-message"
            data-testid="ticket-draft-message"
            rows={4}
            value={draft.message}
            onChange={(e) => onUpdateDraft({ message: e.target.value })}
            placeholder="Type your message for the parish staff (min. 10 characters)..."
            disabled={isSubmitting}
            className={`w-full bg-white border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none disabled:opacity-50 ${
              isLargeText ? 'text-base py-3 px-3.5' : 'text-xs'
            }`}
          />
          {!isMessageValid && draft.message.length > 0 && (
            <p className={`${isLargeText ? 'text-xs' : 'text-[10px]'} text-destructive flex items-center gap-1`}>
              <AlertCircle className={`${isLargeText ? 'w-4 h-4' : 'w-3 h-3'}`} />
              <span>Message must be at least 10 characters.</span>
            </p>
          )}
        </div>
      </div>

      <div className="pt-1 flex items-center justify-end gap-2 border-t border-border/60">
        <button
          type="button"
          data-testid="cancel-ticket-button"
          onClick={onCancel}
          disabled={isSubmitting}
          className={`inline-flex items-center gap-1.5 text-muted hover:text-foreground font-medium rounded-xl border border-border hover:bg-secondary-50 transition-colors disabled:opacity-50 ${
            isLargeText ? 'min-h-[56px] text-base px-4 py-2.5' : 'text-xs px-3 py-2'
          }`}
        >
          <X className={isLargeText ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          data-testid="confirm-ticket-button"
          onClick={onConfirm}
          disabled={!isValid || isSubmitting}
          className={`inline-flex items-center gap-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-xl shadow-xs transition-colors disabled:opacity-50 active:scale-95 ${
            isLargeText ? 'min-h-[56px] text-base px-5 py-2.5' : 'text-xs px-4 py-2'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className={`${isLargeText ? 'w-5 h-5' : 'w-3.5 h-3.5'} animate-spin`} />
          ) : (
            <Send className={isLargeText ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          )}
          <span>{isSubmitting ? 'Submitting...' : 'Confirm & Send'}</span>
        </button>
      </div>
    </div>
  );
}
