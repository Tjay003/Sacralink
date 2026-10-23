// Applicant details on the parish application form: shape, empty value and validation.

export interface ApplicantFormValue {
  legalName: string;
  position: string;
  otherPosition: string;
  phone: string;
  idFile: File | null;
  selfieFile: File | null;
}

export const EMPTY_APPLICANT_FORM: ApplicantFormValue = {
  legalName: '',
  position: '',
  otherPosition: '',
  phone: '',
  idFile: null,
  selfieFile: null,
};

export const OTHER_POSITION = 'Other';
export const MAX_OTHER_POSITION_LENGTH = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function validateFile(file: File | null, label: string, allowPdf: boolean): string | null {
  if (!file) return `${label} is required`;
  const allowed = allowPdf ? ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return allowPdf ? `${label} must be a PDF or image (JPG, PNG, WebP)` : `${label} must be an image (JPG, PNG, WebP)`;
  }
  if (file.size > MAX_FILE_BYTES) return `${label} must be less than 10MB`;
  return null;
}

/** Returns the first problem with the applicant details, or null when they can be submitted. */
export function validateApplicantForm(value: ApplicantFormValue): string | null {
  if (!value.legalName.trim()) return 'Please provide your full legal name';
  if (!value.position) return 'Please choose your position in the parish';
  if (value.position === OTHER_POSITION && !value.otherPosition.trim()) return 'Please type your exact title in the parish';
  if (!value.phone.trim()) return 'Please provide your mobile number';
  return validateFile(value.idFile, 'Government-issued photo ID', true) ?? validateFile(value.selfieFile, 'Selfie holding your ID', false);
}

/** The position sent to the Super Admin: the chosen title, or "Other: <exact title>" when the applicant typed their own. */
export function applicantPositionLabel(value: ApplicantFormValue): string {
  return value.position === OTHER_POSITION ? `${OTHER_POSITION}: ${value.otherPosition.trim()}` : value.position;
}
