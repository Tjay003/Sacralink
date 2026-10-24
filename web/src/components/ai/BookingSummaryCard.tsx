import { useMemo } from 'react';
import { Calendar, Clock, User, FileText, Church, AlertTriangle, Check, Loader2, Edit3, X, Paperclip } from 'lucide-react';
import type { BookingDraft } from '../../lib/bookingGuide';
import { validateRequiredDocuments } from '../../lib/supabase/appointments';
import type { Database } from '../../types/database';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];

interface BookingSummaryCardProps {
  draft: BookingDraft;
  requirements?: SacramentRequirement[];
  attachedDocuments?: Map<string, File>;
  isSubmitting: boolean;
  onConfirm: () => void;
  onChange: () => void;
  onCancel: () => void;
  onGoToDocuments?: () => void;
}

export default function BookingSummaryCard({
  draft,
  requirements = [],
  attachedDocuments,
  isSubmitting,
  onConfirm,
  onChange,
  onCancel,
  onGoToDocuments,
}: BookingSummaryCardProps) {
  const docValidation = useMemo(() => {
    return validateRequiredDocuments(requirements, attachedDocuments);
  }, [requirements, attachedDocuments]);

  return (
    <div
      data-testid="booking-summary-card"
      className="card bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3 text-foreground my-2"
    >
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
              Booking Summary
            </h4>
            <p className="text-sm font-semibold text-foreground">
              {draft.serviceTypeName || 'Sacrament Booking'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-xs divide-y divide-border/40">
        <div className="flex items-start gap-2 pt-1.5 first:pt-0">
          <Church className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-muted block text-[11px]">Parish</span>
            <span data-testid="summary-parish" className="font-medium text-foreground truncate block">
              {draft.churchName || 'Selected Parish'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 pt-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-muted block text-[11px]">Date</span>
            <span data-testid="summary-date" data-date={draft.date} className="font-medium text-foreground block">
              {draft.formattedDate || draft.date}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 pt-1.5">
          <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-muted block text-[11px]">Time</span>
            <span data-testid="summary-time" data-time={draft.time} className="font-medium text-foreground block">
              {draft.formattedTime || draft.time}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 pt-1.5">
          <User className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-muted block text-[11px]">Preferred Priest</span>
            <span data-testid="summary-priest" className="font-medium text-foreground block">
              {draft.requestedPriestName || 'Any available priest'}
            </span>
          </div>
        </div>

        {requirements.length > 0 && (
          <div className="flex items-start gap-2 pt-1.5">
            <Paperclip className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-muted block text-[11px]">Supporting Documents</span>
              <span data-testid="summary-documents" className="font-medium text-foreground block">
                {attachedDocuments && attachedDocuments.size > 0
                  ? `${attachedDocuments.size} document${attachedDocuments.size > 1 ? 's' : ''} attached`
                  : 'None attached'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 pt-1.5">
          <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-muted block text-[11px]">Notes / Intentions</span>
            <span data-testid="summary-notes" className="font-medium text-foreground block break-words">
              {draft.notes ? draft.notes : 'None'}
            </span>
          </div>
        </div>
      </div>

      {draft.priestWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="leading-snug">{draft.priestWarning}</p>
        </div>
      )}

      {!docValidation.ok && (
        <div
          data-testid="missing-documents-warning"
          className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-xs flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-semibold leading-snug">{docValidation.error}</p>
            {onGoToDocuments && (
              <button
                type="button"
                data-testid="summary-goto-documents-button"
                onClick={onGoToDocuments}
                className="text-primary font-medium underline text-[11px] block hover:text-primary-700"
              >
                Attach required documents
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <button
          type="button"
          data-testid="booking-confirm-button"
          disabled={isSubmitting || !docValidation.ok}
          onClick={onConfirm}
          className="w-full bg-primary hover:bg-primary-600 active:scale-[0.98] text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Confirming Booking...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Confirm Booking</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-between px-1 text-xs">
          <button
            type="button"
            data-testid="booking-change-button"
            disabled={isSubmitting}
            onClick={onChange}
            className="text-secondary hover:text-foreground text-[11px] font-medium flex items-center gap-1 transition-colors underline"
          >
            <Edit3 className="w-3 h-3" />
            <span>Change Details</span>
          </button>

          <button
            type="button"
            data-testid="booking-cancel-button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="text-destructive hover:underline text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
