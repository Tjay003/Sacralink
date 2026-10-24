import React, { useRef, useState } from 'react';
import { Camera, CheckCircle, ArrowRight, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import type { Database } from '../../types/database';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];

const DEFAULT_ALLOWED = ['pdf', 'jpg', 'jpeg', 'png'];

function formatAcceptAttribute(allowedFileTypes?: string[] | null): string {
  const types = allowedFileTypes && allowedFileTypes.length > 0
    ? allowedFileTypes
    : DEFAULT_ALLOWED;
  return types
    .map((t) => (t.includes('/') ? t : (t.startsWith('.') ? t : `.${t}`)))
    .join(',');
}

function formatDisplayTypes(allowedFileTypes?: string[] | null): string {
  const types = allowedFileTypes && allowedFileTypes.length > 0
    ? allowedFileTypes
    : DEFAULT_ALLOWED;
  return types
    .map((t) => {
      if (t.includes('/')) {
        const sub = t.split('/')[1].toUpperCase();
        return sub === 'JPEG' ? 'JPG' : sub;
      }
      return t.replace(/^\./, '').toUpperCase();
    })
    .join(', ');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentUploadCardsProps {
  requirements: SacramentRequirement[];
  documents: Map<string, File>;
  onFileSelect: (requirementId: string, file: File) => void;
  onFileRemove: (requirementId: string) => void;
  onContinue: () => void;
  isLoading?: boolean;
}

export default function DocumentUploadCards({
  requirements,
  documents,
  onFileSelect,
  onFileRemove,
  onContinue,
  isLoading = false,
}: DocumentUploadCardsProps) {
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileValidation = (req: SacramentRequirement, file: File): boolean => {
    const allowed = req.allowed_file_types && req.allowed_file_types.length > 0
      ? req.allowed_file_types
      : DEFAULT_ALLOWED;

    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    const fileMime = file.type;

    const isAllowed = allowed.some((t) => {
      if (t.includes('/')) {
        return t.toLowerCase() === fileMime.toLowerCase();
      }
      const clean = t.replace(/^\./, '').toLowerCase();
      return clean === fileExt;
    });

    if (!isAllowed) {
      setCardErrors((prev) => ({
        ...prev,
        [req.id]: `Invalid file type. Allowed: ${formatDisplayTypes(req.allowed_file_types)}`,
      }));
      return false;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setCardErrors((prev) => ({
        ...prev,
        [req.id]: 'File too large. Maximum size is 10MB.',
      }));
      return false;
    }

    setCardErrors((prev) => {
      const next = { ...prev };
      delete next[req.id];
      return next;
    });
    return true;
  };

  const handleInputChange = (req: SacramentRequirement, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (handleFileValidation(req, file)) {
      onFileSelect(req.id, file);
    }
    // Reset input value so re-selecting the same file triggers change
    e.target.value = '';
  };

  const requiredReqs = requirements.filter((r) => Boolean(r.is_required));
  const attachedRequiredCount = requiredReqs.filter((r) => documents.has(r.id)).length;
  const totalRequiredCount = requiredReqs.length;

  if (isLoading) {
    return (
      <div className="card bg-white border border-border rounded-2xl p-4 shadow-xs text-center space-y-2 my-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
        <p className="text-xs text-muted">Loading sacrament requirements...</p>
      </div>
    );
  }

  return (
    <div data-testid="document-upload-cards" className="space-y-2.5 my-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>Supporting Documents</span>
        </h4>
        {totalRequiredCount > 0 && (
          <span className="text-[11px] font-medium text-muted">
            {attachedRequiredCount} of {totalRequiredCount} required attached
          </span>
        )}
      </div>

      <div className="space-y-2">
        {requirements.map((req) => {
          const attachedFile = documents.get(req.id);
          const accept = formatAcceptAttribute(req.allowed_file_types);
          const displayTypes = formatDisplayTypes(req.allowed_file_types);
          const error = cardErrors[req.id];

          return (
            <div
              key={req.id}
              data-testid={`document-card-${req.id}`}
              className="card bg-white border border-border rounded-xl p-3 shadow-2xs space-y-2 text-foreground"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-foreground">
                      {req.requirement_name}
                    </span>
                    {req.is_required ? (
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  {req.description && (
                    <p className="text-[11px] text-muted leading-tight mt-0.5">
                      {req.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  inputRefs.current[req.id] = el;
                }}
                type="file"
                data-testid={`document-input-${req.id}`}
                className="hidden"
                accept={accept}
                onChange={(e) => handleInputChange(req, e)}
              />

              {/* File state: attached or upload button */}
              {attachedFile ? (
                <div
                  data-testid={`document-attached-${req.id}`}
                  className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p
                        data-testid={`document-name-${req.id}`}
                        className="text-xs font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]"
                        title={attachedFile.name}
                      >
                        {attachedFile.name}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatFileSize(attachedFile.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      data-testid={`document-replace-${req.id}`}
                      onClick={() => inputRefs.current[req.id]?.click()}
                      className="text-[11px] text-primary hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-primary/10 transition-colors"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      data-testid={`document-remove-${req.id}`}
                      onClick={() => {
                        onFileRemove(req.id);
                        setCardErrors((prev) => {
                          const next = { ...prev };
                          delete next[req.id];
                          return next;
                        });
                      }}
                      className="text-[11px] text-destructive hover:underline font-medium px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    data-testid={`document-upload-button-${req.id}`}
                    onClick={() => inputRefs.current[req.id]?.click()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium text-xs transition-colors active:scale-[0.99]"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take photo / Choose file</span>
                  </button>
                  <p className="text-[10px] text-muted text-center">
                    Accepted: {displayTypes} (Max 10MB)
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-1 text-[11px] text-destructive font-medium pt-0.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-1 flex items-center justify-end">
        <button
          type="button"
          data-testid="documents-continue-button"
          onClick={onContinue}
          className="w-full sm:w-auto bg-primary hover:bg-primary-600 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
        >
          <span>Continue to Notes</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
