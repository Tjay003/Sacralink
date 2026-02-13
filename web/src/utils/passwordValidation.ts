/**
 * Password Validation Utilities
 * Provides comprehensive password strength checking and validation
 */

export interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
    met?: boolean;
}

export interface PasswordStrength {
    score: number; // 0-4 (0=very weak, 1=weak, 2=medium, 3=strong, 4=very strong)
    label: string;
    color: string;
    requirements: PasswordRequirement[];
    isValid: boolean;
}

/**
 * Password requirements configuration
 */
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    {
        label: 'At least 8 characters',
        test: (password: string) => password.length >= 8
    },
    {
        label: 'Contains uppercase letter (A-Z)',
        test: (password: string) => /[A-Z]/.test(password)
    },
    {
        label: 'Contains lowercase letter (a-z)',
        test: (password: string) => /[a-z]/.test(password)
    },
    {
        label: 'Contains number (0-9)',
        test: (password: string) => /[0-9]/.test(password)
    },
    {
        label: 'Contains special character (!@#$%^&*)',
        test: (password: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    }
];

/**
 * Calculate password strength
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
    if (!password) {
        return {
            score: 0,
            label: 'No password',
            color: 'gray',
            requirements: PASSWORD_REQUIREMENTS.map(req => ({ ...req, met: false })),
            isValid: false
        };
    }

    // Check each requirement
    const requirements = PASSWORD_REQUIREMENTS.map(req => ({
        ...req,
        met: req.test(password)
    }));

    // Count met requirements
    const metCount = requirements.filter(r => r.met).length;
    const allMet = metCount === requirements.length;

    // Calculate score based on met requirements
    let score = 0;
    let label = 'Very Weak';
    let color = 'red';

    if (metCount === 0) {
        score = 0;
        label = 'Very Weak';
        color = 'red';
    } else if (metCount <= 2) {
        score = 1;
        label = 'Weak';
        color = 'red';
    } else if (metCount === 3) {
        score = 2;
        label = 'Medium';
        color = 'orange';
    } else if (metCount === 4) {
        score = 3;
        label = 'Strong';
        color = 'yellow';
    } else if (metCount === 5) {
        score = 4;
        label = 'Very Strong';
        color = 'green';
    }

    // Bonus points for length
    if (password.length >= 12) score = Math.min(4, score + 0.5);
    if (password.length >= 16) score = Math.min(4, score + 0.5);

    return {
        score: Math.floor(score),
        label,
        color,
        requirements,
        isValid: allMet
    };
}

/**
 * Validate password meets all requirements
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const strength = calculatePasswordStrength(password);

    if (strength.isValid) {
        return { valid: true, errors: [] };
    }

    const errors = strength.requirements
        .filter(req => !req.met)
        .map(req => req.label);

    return { valid: false, errors };
}
