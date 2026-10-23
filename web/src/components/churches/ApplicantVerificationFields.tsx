import { useRef } from 'react';
import { FileCheck, Lock, Upload, X } from 'lucide-react';
import { APPLICANT_POSITIONS } from '../../lib/supabase/parishApplications';
import type { ApplicantFormValue } from '../../lib/applicantForm';

interface UploadBoxProps {
  file: File | null;
  onChange: (file: File | null) => void;
  accept: string;
  prompt: string;
  hint: string;
  disabled: boolean;
}

function UploadBox({ file, onChange, accept, prompt, hint, disabled }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        disabled={disabled}
      />
      {file ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 text-muted hover:text-red-500 transition-colors"
            title="Remove file"
            disabled={disabled}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-900/40 cursor-pointer"
          disabled={disabled}
        >
          <div className="p-3 bg-secondary-100 dark:bg-secondary-800 text-secondary-600 rounded-full">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-semibold text-primary">{prompt}</span>
            <p className="text-xs text-muted mt-0.5">{hint}</p>
          </div>
        </button>
      )}
    </>
  );
}

interface ApplicantVerificationFieldsProps {
  value: ApplicantFormValue;
  onChange: (value: ApplicantFormValue) => void;
  disabled: boolean;
}

/** The applicant's own details and proof of identity. Shared by the application form and the resubmit panel. */
export default function ApplicantVerificationFields({ value, onChange, disabled }: ApplicantVerificationFieldsProps) {
  const update = (patch: Partial<ApplicantFormValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div className="p-3 bg-secondary-50 dark:bg-secondary-900/40 border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted">
        <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          Your ID and selfie are stored privately. Only you and the Super Admin can open them, and they are deleted 30 days after your
          application is decided.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">
            Full Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.legalName}
            onChange={(e) => update({ legalName: e.target.value })}
            className="input w-full"
            placeholder="As written on your ID"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Position in the Parish <span className="text-red-500">*</span>
          </label>
          <select
            value={value.position}
            onChange={(e) => update({ position: e.target.value })}
            className="input w-full"
            disabled={disabled}
          >
            <option value="">Select your position</option>
            {APPLICANT_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => update({ phone: e.target.value })}
            className="input w-full"
            placeholder="e.g., 0917 123 4567"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Government-issued Photo ID <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted">Passport, driver&apos;s licence, PhilSys, UMID or postal ID. It must be unexpired.</p>
          <UploadBox
            file={value.idFile}
            onChange={(idFile) => update({ idFile })}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            prompt="Click to upload your ID"
            hint="PDF, PNG, JPG up to 10MB"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Selfie Holding Your ID <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted">A clear photo of your face while holding the same ID, with its details readable.</p>
          <UploadBox
            file={value.selfieFile}
            onChange={(selfieFile) => update({ selfieFile })}
            accept="image/jpeg,image/png,image/webp"
            prompt="Click to upload your selfie"
            hint="PNG, JPG up to 10MB"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
