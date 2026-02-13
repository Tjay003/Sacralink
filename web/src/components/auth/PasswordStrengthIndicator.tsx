import { Check, X } from 'lucide-react';
import { calculatePasswordStrength, type PasswordStrength } from '../../utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
    password: string;
    showRequirements?: boolean;
}

/**
 * PasswordStrengthIndicator - Visual feedback for password strength
 * 
 * Features:
 * - Real-time strength meter (Very Weak to Very Strong)
 * - Color-coded progress bar
 * - Detailed requirements checklist
 * - Green checkmarks for met requirements
 */
export default function PasswordStrengthIndicator({
    password,
    showRequirements = true
}: PasswordStrengthIndicatorProps) {
    const strength: PasswordStrength = calculatePasswordStrength(password);

    // Don't show anything if no password entered
    if (!password) return null;

    // Color classes for strength levels
    const colorClasses = {
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
        gray: 'bg-gray-300'
    };

    const textColorClasses = {
        red: 'text-red-600',
        orange: 'text-orange-600',
        yellow: 'text-yellow-600',
        green: 'text-green-600',
        gray: 'text-gray-600'
    };

    const barColor = colorClasses[strength.color as keyof typeof colorClasses] || colorClasses.gray;
    const textColor = textColorClasses[strength.color as keyof typeof textColorClasses] || textColorClasses.gray;

    // Calculate width percentage (0-100%)
    const widthPercentage = (strength.score / 4) * 100;

    return (
        <div className="mt-2 space-y-2">
            {/* Strength Meter */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-muted">Password Strength</span>
                    <span className={`text-xs font-semibold ${textColor}`}>
                        {strength.label}
                    </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${barColor} transition-all duration-300 ease-in-out`}
                        style={{ width: `${widthPercentage}%` }}
                    />
                </div>
            </div>

            {/* Requirements Checklist */}
            {showRequirements && (
                <div className="space-y-1 pt-1">
                    {strength.requirements.map((req, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-2 text-xs transition-colors ${req.met ? 'text-green-600' : 'text-gray-500'
                                }`}
                        >
                            {req.met ? (
                                <Check className="w-3 h-3 flex-shrink-0" />
                            ) : (
                                <X className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span>{req.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
