import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Building2,
  Search,
  Clock,
  FileText,
  ExternalLink,
  MapPin,
  AlertTriangle,
  UserCheck,
  AlertCircle,
  Eye,
  RefreshCw,
  Heart,
  Church,
  X,
  Check,
  User,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import Pagination from '../../components/common/Pagination';
import { supabase } from '../../lib/supabase';
import {
  getParishApplications,
  getParishApplicationById,
  approveParishApplication,
  rejectParishApplication,
  updateApplicationChecklist,
  type ParishApplicationWithRelations,
  type ApplicationChecklist,
} from '../../lib/supabase/parishApplications';
import { UserName } from '../../components/ui/UserName';
import ApplicantReviewPanel from '../../components/admin/ApplicantReviewPanel';

function formatSubmissionDate(dateStr?: string | null): string {
  if (!dateStr) return 'Recently submitted';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Recently submitted';

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let relative = '';
  if (diffMinutes < 1) {
    relative = 'just now';
  } else if (diffMinutes < 60) {
    relative = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays === 1) {
    relative = '1 day ago';
  } else if (diffDays > 1) {
    relative = `${diffDays} days ago`;
  } else {
    relative = 'today';
  }

  return `${formattedDate} · ${relative}`;
}

const getCashlessLabel = (app: ParishApplicationWithRelations): string | null => {
  const methods: string[] = [];
  if (app.gcash_number) methods.push('GCash');
  if (app.maya_number) methods.push('Maya');
  const bankAcc = (app as unknown as Record<string, unknown>).bank_account_number;
  if (bankAcc) methods.push('Bank');
  if (methods.length === 0) return null;
  return `Cashless: ${methods.join(' & ')}`;
};

interface ParishApplicationDrawerProps {
  app: ParishApplicationWithRelations;
  checklist: ApplicationChecklist;
  onChecklistChange: React.Dispatch<React.SetStateAction<ApplicationChecklist>>;
  onClose: () => void;
  onSaveProgress: () => Promise<void>;
  onApprove: () => void;
  onConfirmApprove: () => Promise<void>;
  isIncompleteConfirmOpen: boolean;
  onCancelIncompleteConfirm: () => void;
  onReject: () => Promise<void>;
  showRejectForm: boolean;
  setShowRejectForm: React.Dispatch<React.SetStateAction<boolean>>;
  rejectionReason: string;
  setRejectionReason: React.Dispatch<React.SetStateAction<string>>;
  actionLoading: boolean;
  actionError: string | null;
  getStatusBadge: (status: string) => React.ReactNode;
  onApplicantReviewed: () => Promise<void>;
}

function ParishApplicationDrawer({
  app,
  checklist,
  onChecklistChange,
  onClose,
  onSaveProgress,
  onApprove,
  onConfirmApprove,
  isIncompleteConfirmOpen,
  onCancelIncompleteConfirm,
  onReject,
  showRejectForm,
  setShowRejectForm,
  rejectionReason,
  setRejectionReason,
  actionLoading,
  actionError,
  getStatusBadge,
  onApplicantReviewed,
}: ParishApplicationDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isIncompleteConfirmOpen) {
          onCancelIncompleteConfirm();
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose, isIncompleteConfirmOpen, onCancelIncompleteConfirm]);

  const isVerified = app.status === 'verified_active';
  const isRejected = app.status === 'rejected';
  const isPastDecision = isVerified || isRejected;

  const formattedDate = app.created_at
    ? new Date(app.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] h-screen h-[100dvh] w-screen overflow-hidden flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (isIncompleteConfirmOpen) {
            onCancelIncompleteConfirm();
          } else {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Slide-over Panel */}
      <div className="relative z-[101] w-full sm:max-w-xl md:max-w-2xl lg:max-w-[640px] h-full bg-white shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* In-drawer Anti-Fraud Incomplete Confirmation View */}
        {isIncompleteConfirmOpen && (
          <div className="absolute inset-0 z-20 bg-white flex flex-col animate-in fade-in duration-150">
            {/* Confirmation Header */}
            <div className="p-6 border-b border-border/80 flex items-start justify-between gap-4 bg-white flex-shrink-0">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate leading-tight">
                    Incomplete Verification
                  </h2>
                  <p className="text-xs sm:text-sm text-amber-700 font-medium truncate mt-0.5">
                    Anti-Fraud Pre-Flight Confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancelIncompleteConfirm}
                aria-label="Back to review"
                className="p-2 text-secondary-400 hover:text-secondary-700 rounded-xl hover:bg-secondary-100 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Confirmation Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Amber Alert Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="font-bold text-sm text-amber-900">
                    Anti-Fraud Criteria Incomplete
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    One or more mandatory verification checks have not been marked as verified for{' '}
                    <strong className="font-semibold text-amber-950">{app.parish_name}</strong>.
                  </p>
                </div>
              </div>

              {/* Current Checklist Status Box */}
              <div>
                <p className="text-[11px] font-bold text-secondary-400 uppercase tracking-wider mb-3">
                  Current Checklist Status
                </p>
                <div className="divide-y divide-border/60 border border-border/70 rounded-2xl overflow-hidden bg-white">
                  <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                    <span className="text-foreground font-medium">Rectory Phone Call</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-lg ${
                        checklist.rectory_call
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {checklist.rectory_call ? '✓ Confirmed' : '✗ Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                    <span className="text-foreground font-medium">CBCP Clergy ID / Celebret</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-lg ${
                        checklist.celebret_verified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {checklist.celebret_verified ? '✓ Verified' : '✗ Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                    <span className="text-foreground font-medium">Merchant Legal Entity</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-lg ${
                        checklist.merchant_entity_verified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {checklist.merchant_entity_verified ? '✓ Matches' : '✗ Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Advisory Prompt */}
              <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
                Are you sure you want to proceed with activation without completing all anti-fraud items?
              </div>
            </div>

            {/* In-drawer Actions */}
            <div className="p-4 sm:p-5 border-t border-border/80 bg-white flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={onCancelIncompleteConfirm}
                className="px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-secondary-700 font-semibold text-xs sm:text-sm cursor-pointer transition disabled:opacity-50"
                disabled={actionLoading}
              >
                Cancel & Review
              </button>
              <button
                type="button"
                onClick={onConfirmApprove}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Activating...' : 'Activate Anyway'}
              </button>
            </div>
          </div>
        )}

        {/* Drawer Main Header */}
        <div className="p-6 border-b border-border/80 flex items-start justify-between gap-4 bg-white flex-shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-primary flex-shrink-0">
              <Church className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate leading-tight">
                {app.parish_name}
              </h2>
              <p className="text-xs sm:text-sm text-secondary-500 font-normal mt-0.5 truncate">
                {app.address}
              </p>
              <div className="inline-block mt-1.5">
                {getStatusBadge(app.status)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 text-secondary-400 hover:text-secondary-700 rounded-xl hover:bg-secondary-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7 overscroll-contain">
          {/* Past Decision Banners */}
          {isVerified && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-3 text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-xs space-y-1">
                <p className="font-bold text-sm text-emerald-800">Verified Active Parish</p>
                <p className="text-emerald-700 leading-relaxed">
                  This parish was audited and approved by Sacralink admins. The church is active in the public directory and cashless donations are enabled.
                </p>
                <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-emerald-800">
                  {app.reviewer && (
                    <span><strong>Reviewed by:</strong> <UserName name={app.reviewer.full_name} deletedAt={app.reviewer.deleted_at} fallback="Sacralink Admin" /></span>
                  )}
                  {app.reviewed_at && (
                    <span><strong>Date:</strong> {new Date(app.reviewed_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="p-4 bg-red-50/80 border border-red-200/80 rounded-2xl flex items-start gap-3 text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-xs space-y-1">
                <p className="font-bold text-sm text-red-800">Application Rejected</p>
                {app.rejection_reason && (
                  <p className="text-red-700 leading-relaxed">
                    <strong>Rejection Reason:</strong> {app.rejection_reason}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-red-800">
                  {app.reviewer && (
                    <span><strong>Reviewed by:</strong> <UserName name={app.reviewer.full_name} deletedAt={app.reviewer.deleted_at} fallback="Sacralink Admin" /></span>
                  )}
                  {app.reviewed_at && (
                    <span><strong>Date:</strong> {new Date(app.reviewed_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Error */}
          {actionError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Section 1: APPLICANT */}
          <div>
            <h3 className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase mb-3">
              Applicant
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-foreground">
                <User className="w-4 h-4 text-secondary-400 shrink-0" />
                <span className="font-medium text-foreground">
                  <UserName name={app.applicant?.full_name} deletedAt={app.applicant?.deleted_at} fallback="Priest / Applicant" />
                </span>
                {app.applicant?.email && (
                  <span className="text-xs text-secondary-500">
                    ({app.applicant.email})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-foreground">
                <Phone className="w-4 h-4 text-secondary-400 shrink-0" />
                <span>{app.contact_number || 'No contact number provided'}</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-foreground">
                <Mail className="w-4 h-4 text-secondary-400 shrink-0" />
                <span>{app.email || 'No parish email provided'}</span>
              </div>

              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-secondary-500">
                <Clock className="w-4 h-4 text-secondary-400 shrink-0" />
                <span>Submitted {formattedDate}</span>
              </div>

              {app.description && (
                <div className="pt-1.5">
                  <p className="text-xs sm:text-sm text-secondary-600 leading-relaxed">
                    {app.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: DOCUMENTS */}
          <div>
            <h3 className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase mb-3">
              Documents
            </h3>
            <div className="divide-y divide-border/60">
              {/* CBCP Clergy ID / Celebret */}
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-medium text-foreground block truncate">
                      {app.celebret_url ? 'Celebret attached' : 'CBCP Clergy ID / Celebret'}
                    </span>
                    <span className="text-[11px] text-secondary-400 block truncate">
                      Official Priest Clergy Identification
                    </span>
                  </div>
                </div>
                {app.celebret_url ? (
                  <a
                    href={app.celebret_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs transition-colors shrink-0 inline-flex items-center gap-1.5"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3.5 h-3.5 text-secondary-400" />
                  </a>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200/60 text-xs font-semibold shrink-0">
                    Missing
                  </span>
                )}
              </div>

              {/* Appointment Decree */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-medium text-foreground block truncate">
                      {app.decree_url ? 'Appointment decree attached' : 'Appointment Decree'}
                    </span>
                    <span className="text-[11px] text-secondary-400 block truncate">
                      Assignment & Jurisdictional Decree
                    </span>
                  </div>
                </div>
                {app.decree_url ? (
                  <a
                    href={app.decree_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs transition-colors shrink-0 inline-flex items-center gap-1.5"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3.5 h-3.5 text-secondary-400" />
                  </a>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200/60 text-xs font-semibold shrink-0">
                    Missing
                  </span>
                )}
              </div>

              {/* Parish Registration & Tax Documents (if present) */}
              {Boolean(
                (app as unknown as Record<string, unknown>).tax_document_url ||
                  (app as unknown as Record<string, unknown>).registration_url
              ) && (
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-foreground block truncate">
                        Parish registration attached
                      </span>
                      <span className="text-[11px] text-secondary-400 block truncate">
                        Official Church Registry & Tax Documents
                      </span>
                    </div>
                  </div>
                  {((app as unknown as Record<string, unknown>).tax_document_url ||
                    (app as unknown as Record<string, unknown>).registration_url) ? (
                    <a
                      href={
                        ((app as unknown as Record<string, unknown>).tax_document_url ||
                          (app as unknown as Record<string, unknown>).registration_url) as string
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs shadow-2xs transition-colors shrink-0 inline-flex items-center gap-1.5"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3.5 h-3.5 text-secondary-400" />
                    </a>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold shrink-0">
                      Attached
                    </span>
                  )}
                </div>
              )}

              {/* Cashless Verification Accounts (if present) */}
              {(app.gcash_number || app.maya_number) && (
                <div className="flex items-center justify-between py-2.5 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-foreground block truncate">
                        Cashless accounts configured
                      </span>
                      <span className="text-[11px] text-secondary-400 block truncate font-mono">
                        {[
                          app.gcash_number && `GCash: ${app.gcash_number}`,
                          app.maya_number && `Maya: ${app.maya_number}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-secondary-100 text-secondary-700 border border-secondary-200/60 text-xs font-semibold shrink-0">
                    Configured
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: VERIFICATION CHECKLIST */}
          <div>
            <h3 className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase mb-3">
              Verification Checklist
            </h3>
            <div className="space-y-1">
              {/* Check 1 */}
              <label
                className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                  checklist.rectory_call ? 'bg-emerald-50/40' : 'hover:bg-secondary-50/70'
                } ${isPastDecision ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={checklist.rectory_call}
                  onChange={(e) =>
                    !isPastDecision &&
                    onChecklistChange((prev) => ({ ...prev, rectory_call: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-border focus:ring-emerald-500/20 accent-emerald-600 mt-0.5 shrink-0"
                  disabled={actionLoading || isPastDecision}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs sm:text-sm font-semibold leading-snug ${checklist.rectory_call ? 'text-emerald-950' : 'text-foreground'}`}>
                    Rectory phone call confirmed
                  </p>
                  <p className="text-[11px] text-secondary-500 mt-0.5 leading-relaxed">
                    Admin staff verified the applicant by speaking with the rectory office landline.
                  </p>
                </div>
              </label>

              {/* Check 2 */}
              <label
                className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                  checklist.celebret_verified ? 'bg-emerald-50/40' : 'hover:bg-secondary-50/70'
                } ${isPastDecision ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={checklist.celebret_verified}
                  onChange={(e) =>
                    !isPastDecision &&
                    onChecklistChange((prev) => ({ ...prev, celebret_verified: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-border focus:ring-emerald-500/20 accent-emerald-600 mt-0.5 shrink-0"
                  disabled={actionLoading || isPastDecision}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs sm:text-sm font-semibold leading-snug ${checklist.celebret_verified ? 'text-emerald-950' : 'text-foreground'}`}>
                    Celebret matches the priest named on the application
                  </p>
                  <p className="text-[11px] text-secondary-500 mt-0.5 leading-relaxed">
                    Confirmed priest is in good standing and duly appointed to this jurisdiction.
                  </p>
                </div>
              </label>

              {/* Check 3 */}
              <label
                className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                  checklist.merchant_entity_verified ? 'bg-emerald-50/40' : 'hover:bg-secondary-50/70'
                } ${isPastDecision ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={checklist.merchant_entity_verified}
                  onChange={(e) =>
                    !isPastDecision &&
                    onChecklistChange((prev) => ({ ...prev, merchant_entity_verified: e.target.checked }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 border-border focus:ring-emerald-500/20 accent-emerald-600 mt-0.5 shrink-0"
                  disabled={actionLoading || isPastDecision}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs sm:text-sm font-semibold leading-snug ${checklist.merchant_entity_verified ? 'text-emerald-950' : 'text-foreground'}`}>
                    Merchant name / cashless matches legal parish entity
                  </p>
                  <p className="text-[11px] text-secondary-500 mt-0.5 leading-relaxed">
                    Ensures cashless donations flow into official church bank or merchant accounts.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Applicant verification (the person applying) */}
          <ApplicantReviewPanel
            key={`${app.id}-${app.applicant_status}`}
            app={app}
            locked={isPastDecision}
            onReviewed={onApplicantReviewed}
          />

          {/* Section 4: REVIEWER NOTES */}
          <div>
            <h3 className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase mb-2">
              Reviewer notes
            </h3>
            {isPastDecision ? (
              <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-2xl text-xs sm:text-sm text-foreground leading-relaxed">
                {checklist.notes || <span className="text-secondary-400 italic">No verification notes recorded.</span>}
              </div>
            ) : (
              <textarea
                value={checklist.notes}
                onChange={(e) =>
                  onChecklistChange((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add a note for the applicant (optional) or record verification notes, call log..."
                rows={3}
                className="w-full p-3.5 rounded-2xl border border-border bg-white text-xs sm:text-sm placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-2xs"
                disabled={actionLoading}
              />
            )}
          </div>

          {/* Rejection Form Drawer / Box */}
          {showRejectForm && !isPastDecision && (
            <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Formal Rejection Reason
                </h4>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="text-xs text-secondary-500 hover:text-secondary-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State the reason for rejection (e.g., Unclear Celebret scan, mismatched rectory phone, unauthorized applicant)..."
                rows={3}
                className="w-full p-3.5 rounded-xl border border-red-200 bg-white text-xs sm:text-sm placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                required
                disabled={actionLoading}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onReject}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Formal Rejection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-white flex items-center justify-end gap-3 flex-shrink-0">
          {isPastDecision ? (
            <div className="flex items-center justify-between w-full">
              <div>
                {isVerified && app.church_id && (
                  <a
                    href={`/churches/${app.church_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-secondary-700 hover:bg-secondary-50 inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Active Church Profile</span>
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-secondary-900 text-white hover:bg-secondary-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {!showRejectForm && (
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading}
                  className="text-red-600 hover:bg-red-50 border border-red-200 font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl cursor-pointer transition disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              <button
                type="button"
                onClick={onSaveProgress}
                disabled={actionLoading}
                className="bg-white hover:bg-secondary-50 text-secondary-700 border border-border font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl cursor-pointer transition disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save progress'}
              </button>
              {app.applicant_status !== 'passed' && (
                <p className="text-[11px] text-amber-700 mr-auto max-w-[14rem] leading-snug">
                  Verify the applicant before approving the parish.
                </p>
              )}
              <button
                type="button"
                onClick={onApprove}
                disabled={actionLoading || app.applicant_status !== 'passed'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                {actionLoading ? (
                  'Processing...'
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Approve and verify</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ParishApplicationsPage() {

  const [applications, setApplications] = useState<ParishApplicationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'under_review' | 'verified_active' | 'rejected'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    under_review: 0,
    verified_active: 0,
    rejected: 0,
  });

  // Modal State
  const [selectedApp, setSelectedApp] = useState<ParishApplicationWithRelations | null>(null);
  const [modalChecklist, setModalChecklist] = useState<ApplicationChecklist>({
    rectory_call: false,
    celebret_verified: false,
    merchant_entity_verified: false,
    notes: '',
  });
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showIncompleteConfirmModal, setShowIncompleteConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const { data } = await supabase.from('parish_applications').select('status');
      if (data) {
        setStatusCounts({
          all: data.length,
          pending: data.filter((a) => a.status === 'pending').length,
          under_review: data.filter((a) => a.status === 'under_review').length,
          verified_active: data.filter((a) => a.status === 'verified_active').length,
          rejected: data.filter((a) => a.status === 'rejected').length,
        });
      }
    } catch (err) {
      console.error('Error fetching application status counts:', err);
    }
  }, []);

  const fetchApplications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data, count, error: fetchErr } = await getParishApplications({
        page: currentPage,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      if (fetchErr) {
        setError(fetchErr.message || 'Failed to load parish applications');
      } else {
        setApplications(data || []);
        setTotalCount(count ?? (data?.length || 0));
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, statusFilter]);

  useEffect(() => {
    void fetchApplications();
    void fetchStatusCounts();
  }, [fetchApplications, fetchStatusCounts]);

  const openReviewModal = (app: ParishApplicationWithRelations) => {
    setSelectedApp(app);
    const rawChecklist = (app.checklist as unknown as ApplicationChecklist) || {};
    setModalChecklist({
      rectory_call: Boolean(rawChecklist.rectory_call),
      celebret_verified: Boolean(rawChecklist.celebret_verified),
      merchant_entity_verified: Boolean(rawChecklist.merchant_entity_verified),
      notes: rawChecklist.notes || '',
    });
    setShowRejectForm(false);
    setShowIncompleteConfirmModal(false);
    setRejectionReason('');
    setActionError(null);
  };

  const refreshSelectedApplication = async () => {
    if (!selectedApp) return;
    const { data } = await getParishApplicationById(selectedApp.id);
    if (data) setSelectedApp(data);
    await fetchApplications();
  };

  const closeReviewModal = () => {
    setSelectedApp(null);
    setShowRejectForm(false);
    setShowIncompleteConfirmModal(false);
    setRejectionReason('');
    setActionError(null);
  };

  const handleSaveChecklist = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionError(null);

    const { error: updateErr } = await updateApplicationChecklist(selectedApp.id, modalChecklist);

    setActionLoading(false);
    if (updateErr) {
      setActionError(updateErr.message || 'Failed to update checklist');
    } else {
      await fetchApplications();
      void fetchStatusCounts();
      closeReviewModal();
    }
  };

  const executeApprove = async () => {
    if (!selectedApp) return;
    setShowIncompleteConfirmModal(false);
    setActionLoading(true);
    setActionError(null);

    const { error: approveErr } = await approveParishApplication(selectedApp.id, modalChecklist);

    setActionLoading(false);
    if (approveErr) {
      setActionError(approveErr.message || 'Failed to approve application');
    } else {
      await fetchApplications();
      void fetchStatusCounts();
      closeReviewModal();
    }
  };

  const handleApprove = () => {
    if (!selectedApp) return;
    const allChecked =
      modalChecklist.rectory_call &&
      modalChecklist.celebret_verified &&
      modalChecklist.merchant_entity_verified;

    if (!allChecked) {
      setShowIncompleteConfirmModal(true);
      return;
    }

    executeApprove();
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!rejectionReason.trim()) {
      setActionError('Please provide a formal rejection reason for the applicant');
    } else {
      setActionLoading(true);
      setActionError(null);

      const { error: rejectErr } = await rejectParishApplication(selectedApp.id, rejectionReason, modalChecklist);

      setActionLoading(false);
      if (rejectErr) {
        setActionError(rejectErr.message || 'Failed to reject application');
      } else {
        await fetchApplications();
        void fetchStatusCounts();
        closeReviewModal();
      }
    }
  };

  // Filtered applications
  const filteredApps = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        app.parish_name.toLowerCase().includes(q) ||
        app.address.toLowerCase().includes(q) ||
        (app.applicant?.full_name && app.applicant.full_name.toLowerCase().includes(q)) ||
        (app.applicant?.email && app.applicant.email.toLowerCase().includes(q));

      return matchesStatus && matchesQuery;
    });
  }, [applications, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    if (statusCounts.all > 0) return statusCounts;
    return {
      all: applications.length,
      pending: applications.filter((a) => a.status === 'pending').length,
      under_review: applications.filter((a) => a.status === 'under_review').length,
      verified_active: applications.filter((a) => a.status === 'verified_active').length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
    };
  }, [statusCounts, applications]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'under_review':
        return (
          <span className="bg-amber-100/70 text-amber-900 border border-amber-200/70 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center">
            Under review
          </span>
        );
      case 'verified_active':
        return (
          <span className="bg-emerald-100/70 text-emerald-800 border border-emerald-200/70 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center">
            Verified
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-red-100/70 text-red-800 border border-red-200/70 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center">
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="bg-secondary-100 text-secondary-700 border border-secondary-200/80 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center">
            Pending
          </span>
        );
    }
  };

  const filterTabs: Array<{
    key: 'all' | 'pending' | 'under_review' | 'verified_active' | 'rejected';
    label: string;
    count: number;
  }> = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'under_review', label: 'Under review', count: counts.under_review },
    { key: 'verified_active', label: 'Verified', count: counts.verified_active },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full px-3 py-0.5 text-xs font-semibold inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Management
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-2 mb-1">
            Church Applications
          </h1>
          <p className="text-sm text-secondary-600 font-normal">
            Review onboarding requests, inspect CBCP clergy credentials, and verify parishes before they appear in the public directory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => { void fetchApplications(); void fetchStatusCounts(); }}
          className="bg-white hover:bg-secondary-50 text-foreground border border-border rounded-xl px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 mb-6">
        {/* Status Tabs */}
        <div className="bg-secondary-100/80 p-1 rounded-xl inline-flex flex-wrap items-center gap-1">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={
                  isActive
                    ? 'bg-white text-foreground shadow-xs font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors'
                    : 'text-secondary-600 hover:text-foreground font-medium text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 cursor-pointer'
                }
              >
                <span>{tab.label}</span>
                <span
                  className={
                    isActive
                      ? 'bg-blue-100 text-primary px-2 py-0.5 rounded-full text-[11px] font-bold'
                      : 'text-secondary-500 font-semibold text-[11px]'
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72 lg:w-80">
          <Search className="w-4 h-4 text-secondary-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search parish or applicant"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-xs sm:text-sm placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
          />
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-secondary-500 text-sm">Loading applications queue...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-600 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <p className="font-semibold">{error}</p>
          <button onClick={() => void fetchApplications(true)} className="btn-secondary text-xs px-4 py-2 mt-2">
            Try Again
          </button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white border border-dashed border-border rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-secondary-100 rounded-full flex items-center justify-center mx-auto text-secondary-400">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-foreground text-base">No applications found</h3>
          <p className="text-secondary-500 text-xs max-w-sm mx-auto">
            {searchQuery
              ? `No parish applications matched "${searchQuery}"`
              : `There are currently no applications matching the "${statusFilter.replace('_', ' ')}" filter.`}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl shadow-xs overflow-hidden divide-y divide-border/60">
          {filteredApps.map((app) => {
            const hasParishRegistration = Boolean(
              (app as unknown as Record<string, unknown>).tax_document_url ||
              (app as unknown as Record<string, unknown>).registration_url
            );
            const cashlessLabel = getCashlessLabel(app);
            const isActionReview = app.status === 'pending' || app.status === 'under_review';

            return (
              <div
                key={app.id}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-3 flex-1 min-w-0">
                  {/* Row 1: Parish Name & Status */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-bold text-lg text-foreground tracking-tight">{app.parish_name}</h3>
                    {getStatusBadge(app.status)}
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                        app.applicant_status === 'passed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : app.applicant_status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : app.applicant_status === 'pending'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      Applicant:{' '}
                      {{ not_submitted: 'not submitted', pending: 'awaiting review', passed: 'verified', rejected: 'rejected' }[app.applicant_status] ?? app.applicant_status}
                    </span>
                  </div>

                  {/* Row 2: Metadata */}
                  <div className="text-xs text-secondary-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-secondary-400" />
                      <span className="truncate">{app.address}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <UserCheck className="w-3.5 h-3.5 shrink-0 text-secondary-400" />
                      <span className="truncate"><UserName name={app.applicant?.full_name} deletedAt={app.applicant?.deleted_at} fallback="Applicant" /></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-secondary-400" />
                      <span>{formatSubmissionDate(app.created_at)}</span>
                    </div>
                  </div>

                  {/* Row 3: Attachment & Feature Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    {app.celebret_url ? (
                      <span className="bg-secondary-50 border border-border/80 text-secondary-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-secondary-500" />
                        Celebret attached
                      </span>
                    ) : (
                      <span className="bg-red-50 border border-red-200/80 text-red-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        Celebret missing
                      </span>
                    )}

                    {app.decree_url ? (
                      <span className="bg-secondary-50 border border-border/80 text-secondary-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-secondary-500" />
                        Appointment decree attached
                      </span>
                    ) : (
                      <span className="bg-red-50 border border-red-200/80 text-red-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        Appointment decree missing
                      </span>
                    )}

                    {hasParishRegistration ? (
                      <span className="bg-secondary-50 border border-border/80 text-secondary-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-secondary-500" />
                        Parish registration attached
                      </span>
                    ) : (
                      <span className="bg-red-50 border border-red-200/80 text-red-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        Parish registration missing
                      </span>
                    )}

                    {cashlessLabel && (
                      <span className="bg-secondary-50 border border-border/80 text-secondary-700 text-xs font-medium px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-secondary-500" />
                        {cashlessLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0 pt-2 md:pt-0">
                  <button
                    type="button"
                    onClick={() => openReviewModal(app)}
                    className={
                      isActionReview
                        ? 'bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap'
                        : 'bg-white hover:bg-secondary-50 text-secondary-800 border border-border rounded-xl font-semibold text-xs sm:text-sm px-5 py-2.5 shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap'
                    }
                  >
                    {isActionReview ? (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Review and verify
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        View
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Component */}
      {totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={searchQuery ? filteredApps.length : totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50]}
          itemName="applications"
        />
      )}

      {/* Review & Checklist Slide-over Drawer */}
      {selectedApp && (
        <ParishApplicationDrawer
          app={selectedApp}
          checklist={modalChecklist}
          onChecklistChange={setModalChecklist}
          onClose={closeReviewModal}
          onSaveProgress={handleSaveChecklist}
          onApprove={handleApprove}
          onConfirmApprove={executeApprove}
          isIncompleteConfirmOpen={showIncompleteConfirmModal}
          onCancelIncompleteConfirm={() => setShowIncompleteConfirmModal(false)}
          onReject={handleReject}
          showRejectForm={showRejectForm}
          setShowRejectForm={setShowRejectForm}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          actionLoading={actionLoading}
          actionError={actionError}
          getStatusBadge={getStatusBadge}
          onApplicantReviewed={refreshSelectedApplication}
        />
      )}
    </div>
  );
}
