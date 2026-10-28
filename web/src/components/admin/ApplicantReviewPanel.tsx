import { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Check, FileText, Lock, RefreshCw } from 'lucide-react';
import {
  getApplicantFileUrls,
  requestApplicantDetails,
  reviewApplicantVerification,
  type ApplicantChecklist,
  type ParishApplicationWithRelations,
} from '../../lib/supabase/parishApplications';
import { StatusBadge } from '../ui/StatusBadge';

const CHECKLIST_ITEMS: Array<{ key: keyof ApplicantChecklist; label: string; hint: string }> = [
  { key: 'id_valid', label: 'ID is valid and unexpired', hint: 'A government-issued photo ID that is readable and not expired.' },
  { key: 'face_matches_selfie', label: 'Face matches the selfie', hint: 'The selfie shows the same person holding this ID.' },
  { key: 'name_matches_documents', label: 'Name matches the Celebret or decree', hint: 'The legal name on the ID appears on the parish documents.' },
  { key: 'position_plausible', label: 'Position is plausible for this parish', hint: 'The stated position fits the appointment decree.' },
];

const EMPTY_CHECKLIST: ApplicantChecklist = {
  id_valid: false,
  face_matches_selfie: false,
  name_matches_documents: false,
  position_plausible: false,
};

function isPdf(path: string | null): boolean {
  return Boolean(path && path.toLowerCase().endsWith('.pdf'));
}

interface ApplicantReviewPanelProps {
  app: ParishApplicationWithRelations;
  /** The parish part is already decided, so the applicant part can no longer change. */
  locked: boolean;
  /** Called after the review is recorded so the page reloads the application. */
  onReviewed: () => Promise<void>;
}

/** Super Admin view of the applicant: details, ID and selfie (short-lived private links), checklist and decision. */
export default function ApplicantReviewPanel({ app, locked, onReviewed }: ApplicantReviewPanelProps) {
  const [fetched, setFetched] = useState<{ key: string; idUrl: string | null; selfieUrl: string | null; error: string | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The drawer keys this panel by application and applicant status, so state starts fresh from the saved review
  const [checklist, setChecklist] = useState<ApplicantChecklist>(() => ({
    ...EMPTY_CHECKLIST,
    ...((app.applicant_checklist as Partial<ApplicantChecklist> | null) ?? {}),
  }));
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const idPath = app.applicant_id_path;
  const selfiePath = app.applicant_selfie_path;
  const hasFiles = Boolean(idPath && selfiePath);
  const status = app.applicant_status;

  const filesKey = `${idPath}|${selfiePath}|${reloadKey}`;
  const current = fetched?.key === filesKey ? fetched : null;
  const urls = current && { idUrl: current.idUrl, selfieUrl: current.selfieUrl };
  const filesError = current?.error ?? null;

  useEffect(() => {
    if (!idPath || !selfiePath) return;
    let cancelled = false;
    void getApplicantFileUrls(idPath, selfiePath).then((result) => {
      if (cancelled) return;
      setFetched({ key: filesKey, idUrl: result.idUrl, selfieUrl: result.selfieUrl, error: result.error?.message ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [idPath, selfiePath, filesKey]);

  const allChecked = CHECKLIST_ITEMS.every((item) => checklist[item.key]);

  const decide = async (passed: boolean) => {
    setBusy(true);
    setError(null);
    const { error: reviewErr } = await reviewApplicantVerification(app, passed, checklist, reason);
    setBusy(false);
    if (reviewErr) {
      setError(reviewErr.message);
      return;
    }
    await onReviewed();
  };

  const request = async () => {
    setBusy(true);
    setError(null);
    const { error: requestErr } = await requestApplicantDetails(app);
    setBusy(false);
    if (requestErr) {
      setError(requestErr.message);
      return;
    }
    setRequested(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-[11px] font-bold text-secondary-400 tracking-wider uppercase">Applicant verification</h3>
        <StatusBadge domain="applicant" status={status} />
      </div>

      <div className="bg-white border border-border/80 rounded-2xl p-4 space-y-4">
        {status === 'not_submitted' ? (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-secondary-600 leading-relaxed">
              The applicant has not sent their legal name, position, ID and selfie yet. The parish cannot be approved until they do and you verify them.
            </p>
            {!locked && (
              <button
                type="button"
                onClick={request}
                disabled={busy || requested}
                className="px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-secondary-700 hover:bg-secondary-50 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <BellRing className="w-3.5 h-3.5" />
                {requested ? 'Request sent' : busy ? 'Sending...' : 'Request applicant details'}
              </button>
            )}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
              <div className="min-w-0">
                <dt className="text-[11px] text-secondary-400">Legal name</dt>
                <dd className="font-semibold text-foreground break-words">{app.applicant_legal_name}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-secondary-400">Position</dt>
                <dd className="font-semibold text-foreground break-words">{app.applicant_position}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] text-secondary-400">Mobile number</dt>
                <dd className="font-semibold text-foreground break-words">{app.applicant_phone}</dd>
              </div>
            </dl>

            {hasFiles ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-secondary-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Private links that expire in 5 minutes. Only you and the applicant can open these.
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((key) => key + 1)}
                    className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reload
                  </button>
                </div>
                {filesError && <p className="text-xs text-red-600">{filesError}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-[11px] font-semibold text-secondary-500">Photo ID</p>
                    {!urls ? (
                      <div className="h-40 rounded-xl bg-secondary-50 border border-border animate-pulse" />
                    ) : urls.idUrl && isPdf(idPath) ? (
                      <a
                        href={urls.idUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-40 rounded-xl border border-border bg-secondary-50 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-primary hover:bg-secondary-100"
                      >
                        <FileText className="w-6 h-6" />
                        Open the ID (PDF)
                      </a>
                    ) : urls.idUrl ? (
                      <a href={urls.idUrl} target="_blank" rel="noopener noreferrer">
                        <img src={urls.idUrl} alt="Applicant photo ID" className="w-full h-40 object-contain rounded-xl border border-border bg-secondary-50" />
                      </a>
                    ) : (
                      <div className="h-40 rounded-xl bg-secondary-50 border border-border flex items-center justify-center text-xs text-secondary-400">
                        Could not load
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-[11px] font-semibold text-secondary-500">Selfie holding the ID</p>
                    {!urls ? (
                      <div className="h-40 rounded-xl bg-secondary-50 border border-border animate-pulse" />
                    ) : urls.selfieUrl ? (
                      <a href={urls.selfieUrl} target="_blank" rel="noopener noreferrer">
                        <img src={urls.selfieUrl} alt="Applicant selfie holding their ID" className="w-full h-40 object-contain rounded-xl border border-border bg-secondary-50" />
                      </a>
                    ) : (
                      <div className="h-40 rounded-xl bg-secondary-50 border border-border flex items-center justify-center text-xs text-secondary-400">
                        Could not load
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-secondary-500 italic">
                {app.applicant_files_delete_after
                  ? 'The ID and selfie were deleted after the retention period. The checklist result below is kept.'
                  : 'No ID or selfie is on file for this application. The checklist result below is kept.'}
              </p>
            )}

            <div className="divide-y divide-border/60">
              {CHECKLIST_ITEMS.map((item) => {
                const editable = status === 'pending' && !locked;
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 py-2.5 ${editable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
                      onChange={(e) => editable && setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                      disabled={!editable || busy}
                      className="w-4 h-4 rounded text-emerald-600 border-border accent-emerald-600 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold leading-snug text-foreground">{item.label}</p>
                      <p className="text-[11px] text-secondary-500 mt-0.5 leading-relaxed">{item.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {status === 'rejected' && app.applicant_rejection_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed">
                <strong>Rejected:</strong> {app.applicant_rejection_reason}
                <span className="block mt-1 text-red-600/80">
                  Attempt {app.applicant_attempts} of 3. The applicant can resubmit until the limit.
                </span>
              </div>
            )}

            {status === 'pending' && !locked && (
              <div className="space-y-3">
                {showReject && (
                  <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Reason shown to the applicant
                    </h4>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., The photo ID is blurry. Please upload a clearer photo."
                      rows={3}
                      className="w-full p-3 rounded-xl border border-red-200 bg-white text-xs sm:text-sm placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                      disabled={busy}
                    />
                    <p className="text-[11px] text-red-600/80">At least 10 characters.</p>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  {showReject ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowReject(false)}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-secondary-700 hover:bg-secondary-50 cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(false)}
                        disabled={busy || reason.trim().length < 10}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {busy ? 'Rejecting...' : 'Reject applicant'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowReject(true)}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Reject applicant
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(true)}
                        disabled={busy || !allChecked}
                        title={allChecked ? undefined : 'Tick every check to verify the applicant'}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        {busy ? 'Saving...' : 'Verify applicant'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
