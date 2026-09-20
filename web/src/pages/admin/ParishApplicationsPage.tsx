import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  MapPin,
  AlertTriangle,
  UserCheck,
  AlertCircle,
  Eye,
  FileCheck,
  Lock,
  RefreshCw,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/common/Pagination';
import { supabase } from '../../lib/supabase';
import {
  getParishApplications,
  approveParishApplication,
  rejectParishApplication,
  updateApplicationChecklist,
  type ParishApplicationWithRelations,
  type ApplicationChecklist,
} from '../../lib/supabase/parishApplications';

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
      return;
    }

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
      case 'verified_active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified & Active
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            Under Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950/60 text-primary border border-primary-200 dark:border-primary-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              Diocese Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-foreground">
            Parish Verification Applications
          </h1>
          <p className="text-muted text-sm mt-1">
            Review onboarding requests, inspect CBCP Clergy credentials, and verify parishes before enabling cashless donations.
          </p>
        </div>

        <button
          onClick={() => { void fetchApplications(); void fetchStatusCounts(); }}
          className="btn-secondary text-xs sm:text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 self-start sm:self-auto"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'under_review', label: 'Under Review', count: counts.under_review },
              { key: 'verified_active', label: 'Verified', count: counts.verified_active },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-secondary-50 dark:bg-secondary-900/60 text-muted hover:text-foreground hover:bg-secondary-100'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-secondary-200 dark:bg-secondary-800 text-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search parish or applicant..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="input w-full !pl-10 text-sm"
          />
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted text-sm">Loading applications queue...</p>
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
        <div className="card p-12 text-center border-dashed space-y-3">
          <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-800 rounded-full flex items-center justify-center mx-auto text-muted">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-foreground">No applications found</h3>
          <p className="text-muted text-xs max-w-sm mx-auto">
            {searchQuery
              ? `No parish applications matched "${searchQuery}"`
              : `There are currently no applications matching the "${statusFilter.replace('_', ' ')}" filter.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="card p-5 hover:shadow-md transition-shadow border border-border flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-bold text-lg text-foreground truncate">{app.parish_name}</h3>
                  {getStatusBadge(app.status)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 text-xs text-muted">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <span className="truncate">{app.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <span className="truncate">Applicant: {app.applicant?.full_name || 'Anonymous User'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                    <span>Submitted: {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>

                {/* Badges / Document tags */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-secondary-100 dark:bg-secondary-800 text-foreground">
                    <FileCheck className="w-3 h-3 text-emerald-600" />
                    Celebret Attached
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-secondary-100 dark:bg-secondary-800 text-foreground">
                    <FileText className="w-3 h-3 text-blue-600" />
                    Chancery Decree Attached
                  </span>
                  {(app.gcash_number || app.maya_number) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      <Lock className="w-3 h-3" />
                      Cashless Accounts: {app.gcash_number ? 'GCash' : ''}{app.gcash_number && app.maya_number ? ' & ' : ''}{app.maya_number ? 'Maya' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border">
                <button
                  onClick={() => openReviewModal(app)}
                  className={
                    app.status === 'verified_active' || app.status === 'rejected'
                      ? 'btn-secondary text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 w-full lg:w-auto justify-center'
                      : 'btn-primary text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 w-full lg:w-auto justify-center'
                  }
                >
                  <Eye className="w-4 h-4" />
                  {app.status === 'verified_active' || app.status === 'rejected' ? 'Review' : 'Review & Verify'}
                </button>
              </div>
            </div>
          ))}
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

      {/* Review & Checklist Modal */}
      {selectedApp && (() => {
        const isVerified = selectedApp.status === 'verified_active';
        const isRejected = selectedApp.status === 'rejected';
        const isPastDecision = isVerified || isRejected;

        return (
          <Modal
            isOpen={true}
            onClose={closeReviewModal}
            title={
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    isVerified
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                      : isRejected
                      ? 'bg-red-100 dark:bg-red-950/60 text-red-600'
                      : 'bg-primary-100 dark:bg-primary-950/60 text-primary'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold text-foreground line-clamp-2 sm:line-clamp-1 leading-snug break-words">
                    {isPastDecision ? `Application Record: ${selectedApp.parish_name}` : `Verification Review: ${selectedApp.parish_name}`}
                  </h2>
                  <p className="text-xs text-muted truncate">
                    {isVerified
                      ? 'Verified Active • Official Chancery Record'
                      : isRejected
                      ? 'Application Rejected • Audit Record'
                      : 'Strict Anti-Fraud & Clergy Credentials Vetting'}
                  </p>
                </div>
              </div>
            }
            size="lg"
          >
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
              {/* Past Decision Banner */}
              {isVerified && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start gap-3 text-emerald-900 dark:text-emerald-100">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 text-xs space-y-1">
                    <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Verified Active Parish</p>
                    <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed">
                      This parish was audited and approved by the Chancery. The church is active in the public directory and cashless donations are enabled.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
                      {selectedApp.reviewer && (
                        <span><strong>Reviewed by:</strong> {selectedApp.reviewer.full_name || 'Diocesan Chancery'}</span>
                      )}
                      {selectedApp.reviewed_at && (
                        <span><strong>Date:</strong> {new Date(selectedApp.reviewed_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3 text-red-900 dark:text-red-100">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 text-xs space-y-1">
                    <p className="font-bold text-sm text-red-800 dark:text-red-300">Application Rejected</p>
                    {selectedApp.rejection_reason && (
                      <p className="text-red-700 dark:text-red-400 leading-relaxed">
                        <strong>Rejection Reason:</strong> {selectedApp.rejection_reason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-red-800 dark:text-red-200">
                      {selectedApp.reviewer && (
                        <span><strong>Reviewed by:</strong> {selectedApp.reviewer.full_name || 'Diocesan Chancery'}</span>
                      )}
                      {selectedApp.reviewed_at && (
                        <span><strong>Date:</strong> {new Date(selectedApp.reviewed_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error in modal */}
              {actionError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}

              {/* Parish & Applicant Details Card */}
              <div className="p-4 bg-secondary-50 dark:bg-secondary-900/50 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Parish & Applicant Information</h4>
                  {getStatusBadge(selectedApp.status)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted block">Parish Address:</span>
                    <span className="font-semibold text-foreground">{selectedApp.address}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Applicant Name:</span>
                    <span className="font-semibold text-foreground">
                      {selectedApp.applicant?.full_name || 'Unknown User'} ({selectedApp.applicant?.email || 'No email'})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block">Contact / Rectory Phone:</span>
                    <span className="font-semibold text-foreground">{selectedApp.contact_number || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-muted block">Parish Email:</span>
                    <span className="font-semibold text-foreground">{selectedApp.email || 'Not provided'}</span>
                  </div>
                  {selectedApp.gcash_number && (
                    <div>
                      <span className="text-muted block">GCash Account Number:</span>
                      <span className="font-semibold text-foreground font-mono">{selectedApp.gcash_number}</span>
                    </div>
                  )}
                  {selectedApp.maya_number && (
                    <div>
                      <span className="text-muted block">Maya Account Number:</span>
                      <span className="font-semibold text-foreground font-mono">{selectedApp.maya_number}</span>
                    </div>
                  )}
                </div>

                {selectedApp.description && (
                  <div className="text-xs pt-1 border-t border-border/60">
                    <span className="text-muted block mb-0.5">Parish Description:</span>
                    <p className="text-foreground leading-relaxed">{selectedApp.description}</p>
                  </div>
                )}
              </div>

              {/* Uploaded Verification Documents */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Submitted Verification Documents
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Celebret Link */}
                  <a
                    href={selectedApp.celebret_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-secondary-50 dark:hover:bg-secondary-900/50 flex items-center justify-between group transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          CBCP Clergy ID / Celebret
                        </p>
                        <p className="text-[11px] text-muted truncate">View Scanned Document</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted group-hover:text-primary shrink-0 ml-2" />
                  </a>

                  {/* Chancery Decree Link */}
                  <a
                    href={selectedApp.decree_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-border hover:border-primary hover:bg-secondary-50 dark:hover:bg-secondary-900/50 flex items-center justify-between group transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-lg shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                          Chancery Appointment Decree
                        </p>
                        <p className="text-[11px] text-muted truncate">View Scanned Document</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted group-hover:text-primary shrink-0 ml-2" />
                  </a>
                </div>
              </div>

              {/* Anti-Fraud Verification Checklist */}
              <div className="p-5 bg-primary-50/40 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    {isPastDecision ? 'Completed Anti-Fraud Checklist' : 'Mandatory Anti-Fraud Checklist'}
                  </h4>
                  <span className="text-[11px] font-semibold text-primary">
                    {isPastDecision ? 'Archived Audit Record' : 'Super Admin Verification'}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Item 1: Rectory Call */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-secondary-900 border border-border transition-colors shadow-sm ${
                      isPastDecision ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={modalChecklist.rectory_call}
                      onChange={(e) =>
                        !isPastDecision && setModalChecklist((prev) => ({ ...prev, rectory_call: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary"
                      disabled={actionLoading || isPastDecision}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        Rectory Phone Call Confirmed with Chancery
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Chancery staff verified the applicant by speaking with the rectory office landline.
                      </p>
                    </div>
                  </label>

                  {/* Item 2: Celebret Verified */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-secondary-900 border border-border transition-colors shadow-sm ${
                      isPastDecision ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={modalChecklist.celebret_verified}
                      onChange={(e) =>
                        !isPastDecision && setModalChecklist((prev) => ({ ...prev, celebret_verified: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary"
                      disabled={actionLoading || isPastDecision}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        CBCP Clergy ID / Celebret Verified with Diocese Roster
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Confirmed priest is in good standing and duly appointed to this jurisdiction.
                      </p>
                    </div>
                  </label>

                  {/* Item 3: Merchant Name */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-secondary-900 border border-border transition-colors shadow-sm ${
                      isPastDecision ? 'cursor-default' : 'cursor-pointer hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={modalChecklist.merchant_entity_verified}
                      onChange={(e) =>
                        !isPastDecision && setModalChecklist((prev) => ({ ...prev, merchant_entity_verified: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary"
                      disabled={actionLoading || isPastDecision}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">
                        Merchant Name / GCash / Maya Matches Legal Parish Entity
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Ensures cashless donations flow into official church bank or merchant accounts.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Review Notes */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Chancery Internal Review Notes
                  </label>
                  {isPastDecision ? (
                    <div className="p-3 bg-white dark:bg-secondary-900 border border-border rounded-xl text-xs text-foreground">
                      {modalChecklist.notes || <span className="text-muted italic">No internal review notes recorded.</span>}
                    </div>
                  ) : (
                    <textarea
                      value={modalChecklist.notes}
                      onChange={(e) =>
                        setModalChecklist((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Record verification notes, diocese call log, or specific remarks..."
                      rows={2}
                      className="input w-full text-xs"
                      disabled={actionLoading}
                    />
                  )}
                </div>
              </div>

              {/* Rejection Form Drawer */}
              {showRejectForm && !isPastDecision ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Formal Rejection Reason
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="State the reason for rejection (e.g., Unclear Celebret scan, mismatched rectory phone, unauthorized applicant)..."
                    rows={3}
                    className="input w-full text-xs border-red-300"
                    required
                    disabled={actionLoading}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleReject}
                      className="btn-danger px-4 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Rejecting...' : 'Confirm Formal Rejection'}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
                {isPastDecision ? (
                  <>
                    <div>
                      {isVerified && selectedApp.church_id && (
                        <a
                          href={`/churches/${selectedApp.church_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Active Church Profile
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={closeReviewModal}
                        className="btn-primary text-xs px-5 py-2 rounded-xl"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleSaveChecklist}
                        className="btn-secondary text-xs px-3.5 py-2 rounded-xl w-full sm:w-auto"
                        disabled={actionLoading}
                      >
                        Save Progress
                      </button>
                      {!showRejectForm && (
                        <button
                          type="button"
                          onClick={() => setShowRejectForm(true)}
                          className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 px-3 py-2 rounded-xl font-medium border border-transparent hover:border-red-200 w-full sm:w-auto"
                          disabled={actionLoading}
                        >
                          Reject Application
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={closeReviewModal}
                        className="btn-secondary text-xs px-4 py-2 rounded-xl"
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApprove}
                        className="btn-primary text-xs font-semibold px-5 py-2 rounded-xl shadow-md flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          'Processing Approval...'
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Approve & Activate Parish
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Custom Confirmation Modal: Incomplete Anti-Fraud Checklist */}
      {showIncompleteConfirmModal && selectedApp && (
        <Modal
          isOpen={showIncompleteConfirmModal}
          onClose={() => setShowIncompleteConfirmModal(false)}
          title="Incomplete Verification Checklist"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">
                  Anti-Fraud Criteria Incomplete
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  One or more mandatory Chancery verification checks have not been marked as verified for <strong>{selectedApp.parish_name}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-secondary-50 rounded-xl space-y-2 text-xs border border-border">
              <p className="font-semibold text-foreground">Current Checklist Status:</p>
              <div className="space-y-1 text-muted">
                <div className="flex items-center gap-2">
                  <span className={modalChecklist.rectory_call ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                    {modalChecklist.rectory_call ? "✓ Confirmed" : "✗ Pending"}
                  </span>
                  <span>Rectory Phone Call</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={modalChecklist.celebret_verified ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                    {modalChecklist.celebret_verified ? "✓ Verified" : "✗ Pending"}
                  </span>
                  <span>CBCP Clergy ID / Celebret</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={modalChecklist.merchant_entity_verified ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                    {modalChecklist.merchant_entity_verified ? "✓ Matches" : "✗ Pending"}
                  </span>
                  <span>Merchant Legal Entity</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted">
              Are you sure you want to proceed with activation without completing all anti-fraud items?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowIncompleteConfirmModal(false)}
                className="btn-secondary text-xs px-3.5 py-2 rounded-xl"
                disabled={actionLoading}
              >
                Cancel & Review
              </button>
              <button
                type="button"
                onClick={executeApprove}
                className="btn-primary text-xs font-semibold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                disabled={actionLoading}
              >
                {actionLoading ? 'Activating...' : 'Activate Anyway'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
