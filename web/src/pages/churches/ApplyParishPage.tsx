import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  MapPin,
  X,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ChurchLocationPicker, { isWithinSjdmBounds } from '../../components/churches/ChurchLocationPicker';
import ApplicantVerificationFields from '../../components/churches/ApplicantVerificationFields';
import {
  isMobileNumber,
  MAX_LANDLINE_LENGTH,
  MOBILE_NUMBER_HINT,
  MOBILE_NUMBER_LENGTH,
  toLandlineChars,
  toMobileDigits,
} from '../../lib/phoneNumbers';
import {
  EMPTY_APPLICANT_FORM,
  applicantPositionLabel,
  validateApplicantForm,
  type ApplicantFormValue,
} from '../../lib/applicantForm';
import {
  APPLICANT_MAX_ATTEMPTS,
  submitParishApplication,
  submitApplicantVerification,
  getMyParishApplications,
  type ParishApplication,
} from '../../lib/supabase/parishApplications';

const APPLICANT_STATUS_LABEL: Record<string, string> = {
  not_submitted: 'not submitted',
  pending: 'pending review',
  passed: 'verified',
  rejected: 'rejected',
};

function statusChipClass(status: string): string {
  if (status === 'verified_active' || status === 'passed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
  }
  if (status === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
  if (status === 'under_review' || status === 'not_submitted') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
}

export default function ApplyParishPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state
  const [parishName, setParishName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gcashNumber, setGcashNumber] = useState('');
  const [mayaNumber, setMayaNumber] = useState('');

  // Files state
  const [celebretFile, setCelebretFile] = useState<File | null>(null);
  const [decreeFile, setDecreeFile] = useState<File | null>(null);
  const celebretInputRef = useRef<HTMLInputElement>(null);
  const decreeInputRef = useRef<HTMLInputElement>(null);

  // Applicant (the person applying) details and proof of identity
  const [applicantForm, setApplicantForm] = useState<ApplicantFormValue>(EMPTY_APPLICANT_FORM);
  const [applicantWarning, setApplicantWarning] = useState<string | null>(null);

  // Completing or redoing the applicant part of an earlier application
  const [resubmitFor, setResubmitFor] = useState<string | null>(null);
  const [resubmitForm, setResubmitForm] = useState<ApplicantFormValue>(EMPTY_APPLICANT_FORM);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  // Status & loading
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedApp, setSubmittedApp] = useState<ParishApplication | null>(null);

  // User's previous applications
  const [myApplications, setMyApplications] = useState<ParishApplication[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (user) {
      getMyParishApplications().then(({ data }) => {
        if (data && data.length > 0) {
          setMyApplications(data);
        }
      });
    }
  }, [user]);

  const validateFile = (file: File | null, label: string): string | null => {
    if (!file) return `${label} is required for verification`;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return `${label} must be a PDF or image (JPG, PNG, WebP)`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return `${label} must be less than 10MB`;
    }
    return null;
  };

  const refreshApplications = async () => {
    const { data } = await getMyParishApplications();
    if (data) setMyApplications(data);
  };

  const handleResubmit = async (applicationId: string) => {
    setResubmitError(null);
    const problem = validateApplicantForm(resubmitForm);
    if (problem) {
      setResubmitError(problem);
      return;
    }

    setResubmitting(true);
    const { error: submitErr } = await submitApplicantVerification(applicationId, {
      legal_name: resubmitForm.legalName.trim(),
      position: applicantPositionLabel(resubmitForm),
      phone: resubmitForm.phone.trim(),
      id_file: resubmitForm.idFile!,
      selfie_file: resubmitForm.selfieFile!,
    });
    setResubmitting(false);

    if (submitErr) {
      setResubmitError(submitErr.message);
      return;
    }
    setResubmitFor(null);
    setResubmitForm(EMPTY_APPLICANT_FORM);
    await refreshApplications();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!parishName.trim()) {
      setError('Please provide the official parish name');
      return;
    }
    if (!address.trim()) {
      setError('Please provide the complete parish address');
      return;
    }

    const celebretErr = validateFile(celebretFile, 'CBCP Clergy ID / Celebret document');
    if (celebretErr) {
      setError(celebretErr);
      return;
    }

    const decreeErr = validateFile(decreeFile, 'Appointment Decree');
    if (decreeErr) {
      setError(decreeErr);
      return;
    }

    if (gcashNumber && !isMobileNumber(gcashNumber)) {
      setError(`GCash number must be ${MOBILE_NUMBER_HINT}`);
      return;
    }
    if (mayaNumber && !isMobileNumber(mayaNumber)) {
      setError(`Maya number must be ${MOBILE_NUMBER_HINT}`);
      return;
    }

    if (latitude !== null && longitude !== null && !isWithinSjdmBounds(latitude, longitude)) {
      setError('Church location coordinates must be within the City of San Jose del Monte, Bulacan.');
      return;
    }

    const applicantErr = validateApplicantForm(applicantForm);
    if (applicantErr) {
      setError(applicantErr);
      return;
    }

    setSubmitting(true);
    setApplicantWarning(null);

    try {
      const { data, error: submitErr, applicantError } = await submitParishApplication({
        parish_name: parishName,
        address,
        contact_number: contactNumber,
        email: email || undefined,
        description: description || undefined,
        latitude,
        longitude,
        gcash_number: gcashNumber || undefined,
        maya_number: mayaNumber || undefined,
        celebret_file: celebretFile!,
        decree_file: decreeFile!,
        applicant: {
          legal_name: applicantForm.legalName.trim(),
          position: applicantPositionLabel(applicantForm),
          phone: applicantForm.phone.trim(),
          id_file: applicantForm.idFile!,
          selfie_file: applicantForm.selfieFile!,
        },
      });

      if (submitErr || !data) {
        throw submitErr || new Error('Failed to submit application');
      }

      if (applicantError) {
        setApplicantWarning(
          `Your parish details were saved, but your applicant details could not be submitted: ${applicantError.message}. Open My Applications to send them again.`
        );
      }
      setSubmittedApp(data);
      setMyApplications((prev) => [data, ...prev]);
    } catch (err) {
      console.error('Submission failed:', err);
      setError(err instanceof Error && err.message ? err.message : 'Failed to submit parish onboarding application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedApp) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Application Submitted Successfully</h2>
          <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
            Your verification request for <strong className="text-foreground">{submittedApp.parish_name}</strong> has been sent to the Super Admin review queue.
          </p>

          {applicantWarning && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-left text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{applicantWarning}</p>
            </div>
          )}

          <div className="bg-secondary-50 dark:bg-secondary-900/40 p-4 rounded-xl text-left border border-border space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              What Happens Next:
            </div>
            <ul className="text-xs text-muted space-y-2 list-disc list-inside">
              <li>Super Admins verify your official CBCP Clergy ID / Celebret credentials.</li>
              <li>Super Admins check your own photo ID and selfie to confirm you are who you say you are.</li>
              <li>A confirmation phone call is made to the parish rectory landline.</li>
              <li>GCash/Maya merchant accounts are validated against the legal parish entity to safeguard donations.</li>
              <li>Upon approval, your parish is marked <span className="font-semibold text-emerald-600">Verified & Active</span>, unlocking cashless donations and public sacrament booking.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <button
              onClick={() => navigate('/churches')}
              className="btn-primary px-6 py-2.5 rounded-xl font-medium"
            >
              Browse Parishes
            </button>
            <button
              onClick={() => {
                setSubmittedApp(null);
                setParishName('');
                setAddress('');
                setContactNumber('');
                setEmail('');
                setDescription('');
                setCelebretFile(null);
                setDecreeFile(null);
                setApplicantForm(EMPTY_APPLICANT_FORM);
                setApplicantWarning(null);
                setShowHistory(true);
              }}
              className="btn-secondary px-6 py-2.5 rounded-xl font-medium"
            >
              View My Applications
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Breadcrumb */}
      <div>
        <button
          onClick={() => navigate('/churches')}
          className="flex items-center text-muted hover:text-foreground mb-4 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Churches
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950/60 text-primary border border-primary-200 dark:border-primary-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verification Pipeline
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-foreground">
              Parish Onboarding Application
            </h1>
            <p className="text-muted text-sm mt-1 max-w-2xl">
              Register your Catholic parish with SacraLink. Official CBCP credentials and appointment decrees are strictly vetted before cashless donation features are unlocked.
            </p>
          </div>

          {myApplications.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="btn-secondary text-xs sm:text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 self-start sm:self-auto"
            >
              <Clock className="w-4 h-4" />
              {showHistory ? 'Hide My Submissions' : `My Applications (${myApplications.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Existing Applications Banner / Drawer */}
      {showHistory && myApplications.length > 0 && (
        <div className="card p-5 border-primary/30 bg-primary-50/30 dark:bg-primary-950/20 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Your Submitted Applications
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {myApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-secondary-900 border border-border p-4 rounded-xl shadow-sm space-y-2"
              >
                <h4 className="font-semibold text-sm text-foreground truncate">{app.parish_name}</h4>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusChipClass(app.status)}`}>
                    Parish: {app.status.replace('_', ' ')}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusChipClass(app.applicant_status)}`}>
                    Applicant: {APPLICANT_STATUS_LABEL[app.applicant_status] ?? app.applicant_status}
                  </span>
                </div>
                <p className="text-xs text-muted flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {app.address}
                </p>
                <p className="text-[11px] text-muted">
                  Submitted: {new Date(app.created_at || Date.now()).toLocaleDateString()}
                </p>
                {app.rejection_reason && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                    <strong>Rejection reason:</strong> {app.rejection_reason}
                  </div>
                )}
                {app.applicant_status === 'rejected' && app.applicant_rejection_reason && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                    <strong>Applicant details rejected:</strong> {app.applicant_rejection_reason}
                  </div>
                )}
                {(app.status === 'pending' || app.status === 'under_review') &&
                  (app.applicant_status === 'not_submitted' || app.applicant_status === 'rejected') &&
                  (app.applicant_attempts >= APPLICANT_MAX_ATTEMPTS ? (
                    <p className="text-xs text-muted">
                      You have used all {APPLICANT_MAX_ATTEMPTS} attempts for your applicant details. Please start a new application.
                    </p>
                  ) : resubmitFor === app.id ? (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <ApplicantVerificationFields value={resubmitForm} onChange={setResubmitForm} disabled={resubmitting} />
                      {resubmitError && <p className="text-xs text-red-600">{resubmitError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResubmit(app.id)}
                          className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
                          disabled={resubmitting}
                        >
                          {resubmitting ? 'Submitting...' : 'Submit applicant details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResubmitFor(null);
                            setResubmitError(null);
                          }}
                          className="btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
                          disabled={resubmitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setResubmitFor(app.id);
                        setResubmitForm(EMPTY_APPLICANT_FORM);
                        setResubmitError(null);
                      }}
                      className="btn-secondary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {app.applicant_status === 'rejected' ? 'Resubmit applicant details' : 'Submit applicant details'}
                      {app.applicant_attempts > 0 && ` (attempt ${app.applicant_attempts + 1} of ${APPLICANT_MAX_ATTEMPTS})`}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Application Submission Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Card 1: Parish Details */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-950/50 rounded-lg text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">1. Parish Information</h2>
              <p className="text-xs text-muted">Enter official church name and contact details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Official Parish Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={parishName}
                onChange={(e) => setParishName(e.target.value)}
                className="input w-full"
                placeholder="e.g., St. Joseph the Worker Parish"
                required
                disabled={submitting}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Parish Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input w-full"
                placeholder="e.g., Tungkong Mangga, City of San Jose del Monte, Bulacan"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Rectory / Office Landline <span className="text-muted text-xs font-normal">(For verification phone call)</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(toLandlineChars(e.target.value))}
                maxLength={MAX_LANDLINE_LENGTH}
                className="input w-full"
                placeholder="e.g., (044) 123-4567 or 0917-xxx-xxxx"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Parish Email Address <span className="text-muted text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="e.g., parish.office@gmail.com"
                disabled={submitting}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Brief Parish History / Description <span className="text-muted text-xs font-normal">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Describe the parish community, feast day patron, or history..."
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Location Map & Coordinates */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg text-blue-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">2. Geographical Location</h2>
              <p className="text-xs text-muted">Pinpoint your church on the interactive map for the nearby parish recommender</p>
            </div>
          </div>

          <div>
            <ChurchLocationPicker
              latitude={latitude}
              longitude={longitude}
              initialAddress={address}
              onChange={({ latitude: lat, longitude: lng, address: selectedAddr }) => {
                setLatitude(lat);
                setLongitude(lng);
                if (selectedAddr && !address) {
                  setAddress(selectedAddr);
                }
              }}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Card 3: Cashless Donation Accounts (Optional) */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/50 rounded-lg text-purple-600">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">3. Cashless Donation Information (Locked until Verified)</h2>
              <p className="text-xs text-muted">
                GCash / Maya numbers will be locked and hidden from parishioners until a Super Admin verifies entity ownership.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                GCash Registered Number <span className="text-muted text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={gcashNumber}
                onChange={(e) => setGcashNumber(toMobileDigits(e.target.value))}
                maxLength={MOBILE_NUMBER_LENGTH}
                className="input w-full"
                placeholder="e.g., 09171234567"
                disabled={submitting}
              />
              <p className="text-[11px] text-muted mt-1">Must match the legal parish entity or designated parish priest.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Maya Registered Number <span className="text-muted text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={mayaNumber}
                onChange={(e) => setMayaNumber(toMobileDigits(e.target.value))}
                maxLength={MOBILE_NUMBER_LENGTH}
                className="input w-full"
                placeholder="e.g., 09181234567"
                disabled={submitting}
              />
              <p className="text-[11px] text-muted mt-1">Must match the legal parish entity or designated parish priest.</p>
            </div>
          </div>
        </div>

        {/* Card 4: Mandatory Clergy Credentials Upload */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">4. Mandatory Verification Credentials</h2>
              <p className="text-xs text-muted">
                Upload scans of valid clergy identification and appointment decrees for verification
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Celebret / CBCP Clergy ID Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                CBCP Clergy ID / Celebret Card <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted">
                Official document issued by CBCP or Ordinary confirming active sacerdotal faculty.
              </p>

              <input
                type="file"
                ref={celebretInputRef}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setCelebretFile(file);
                }}
                disabled={submitting}
              />

              {celebretFile ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{celebretFile.name}</p>
                      <p className="text-xs text-muted">{(celebretFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCelebretFile(null)}
                    className="p-1 text-muted hover:text-red-500 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => celebretInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-900/40 cursor-pointer"
                  disabled={submitting}
                >
                  <div className="p-3 bg-secondary-100 dark:bg-secondary-800 text-secondary-600 rounded-full">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-primary">Click to upload Celebret / Clergy ID</span>
                    <p className="text-xs text-muted mt-0.5">PDF, PNG, JPG up to 10MB</p>
                  </div>
                </button>
              )}
            </div>

            {/* Appointment Decree Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                Appointment Decree <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted">
                Official decree of assignment signed by the Local Ordinary or Vicar General.
              </p>

              <input
                type="file"
                ref={decreeInputRef}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setDecreeFile(file);
                }}
                disabled={submitting}
              />

              {decreeFile ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{decreeFile.name}</p>
                      <p className="text-xs text-muted">{(decreeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDecreeFile(null)}
                    className="p-1 text-muted hover:text-red-500 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => decreeInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-900/40 cursor-pointer"
                  disabled={submitting}
                >
                  <div className="p-3 bg-secondary-100 dark:bg-secondary-800 text-secondary-600 rounded-full">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-primary">Click to upload Appointment Decree</span>
                    <p className="text-xs text-muted mt-0.5">PDF, PNG, JPG up to 10MB</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card 5: The applicant's own verification */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-lg text-amber-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">5. Applicant Verification</h2>
              <p className="text-xs text-muted">Confirm who you are. You become the parish Church Admin once this and the parish are verified.</p>
            </div>
          </div>

          <ApplicantVerificationFields value={applicantForm} onChange={setApplicantForm} disabled={submitting} />
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/churches')}
            className="w-full sm:w-auto btn-secondary px-6 py-2.5 rounded-xl font-medium"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto btn-primary px-8 py-2.5 rounded-xl font-semibold shadow-md flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading & Submitting...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Submit Verification Application
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
