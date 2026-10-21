import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
        label?: string;
        showPercentage?: boolean;
    };
    iconBgColor?: string;
    iconColor?: string;
    gradientFrom?: string;
    gradientTo?: string;
    gradientDirection?: 'to-br' | 'to-tr' | 'to-bl' | 'to-tl' | 'to-r' | 'to-l';
    isActive?: boolean;
    onClick?: () => void;
    loading?: boolean;
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    iconBgColor = 'bg-purple-100',
    iconColor = 'text-purple-600',
    gradientFrom = 'from-blue-600',
    gradientTo = 'to-blue-400',
    gradientDirection = 'to-br',
    isActive = false,
    onClick,
    loading = false,
}: StatCardProps) {
    // Format large numbers with commas
    const formattedValue = typeof value === 'number'
        ? value.toLocaleString('en-US')
        : value;

    const isInteractive = isActive;

    // Determine dynamic hover gradient based on explicit props or iconColor
    const { fromGradient, toGradient } = (() => {
        // If an explicit non-default gradient was passed, honor it
        if (gradientFrom && gradientTo && gradientFrom !== 'from-blue-600') {
            return { fromGradient: gradientFrom, toGradient: gradientTo };
        }
        // Match card hover color with its icon theme
        if (iconColor?.includes('purple')) {
            return { fromGradient: 'from-purple-600', toGradient: 'to-indigo-600' };
        }
        if (iconColor?.includes('yellow') || iconColor?.includes('amber')) {
            return { fromGradient: 'from-amber-500', toGradient: 'to-amber-600' };
        }
        if (iconColor?.includes('emerald') || iconColor?.includes('green')) {
            return { fromGradient: 'from-emerald-600', toGradient: 'to-teal-600' };
        }
        if (iconColor?.includes('rose') || iconColor?.includes('red')) {
            return { fromGradient: 'from-rose-600', toGradient: 'to-rose-500' };
        }
        return { fromGradient: gradientFrom || 'from-blue-600', toGradient: gradientTo || 'to-blue-500' };
    })();

    // Map gradient direction to full Tailwind class
    const gradientClass = (() => {
        switch (gradientDirection) {
            case 'to-br': return 'bg-gradient-to-br';
            case 'to-tr': return 'bg-gradient-to-tr';
            case 'to-bl': return 'bg-gradient-to-bl';
            case 'to-tl': return 'bg-gradient-to-tl';
            case 'to-r': return 'bg-gradient-to-r';
            case 'to-l': return 'bg-gradient-to-l';
            default: return 'bg-gradient-to-br';
        }
    })();

    return (
        <div
            onClick={onClick}
            className={`
                rounded-2xl p-6 shadow-sm border transition-all duration-300 relative overflow-hidden
                ${onClick ? 'cursor-pointer' : ''}
                ${isActive
                    ? `${gradientClass} ${fromGradient} ${toGradient} border-transparent text-white shadow-lg`
                    : 'bg-white border-gray-100 hover:shadow-md'
                }
                group
            `}
        >
            {/* Hover gradient overlay */}
            {!isActive && (
                <div className={`
                    absolute inset-0 ${gradientClass} ${fromGradient} ${toGradient} 
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
                `} />
            )}

            {/* Content */}
            <div className="relative z-10">
                {/* Icon in top-right corner */}
                <div className={`
                    absolute top-0 right-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300
                    ${isActive || isInteractive
                        ? 'bg-white/20 text-white'
                        : `${iconBgColor} ${iconColor} group-hover:bg-white/20 group-hover:text-white`
                    }
                `}>
                    <Icon className="w-7 h-7" />
                </div>

                {/* Content stacked vertically */}
                <div className="pr-16">
                    <p className={`
                        text-sm font-medium mb-2 transition-colors duration-300
                        ${isActive ? 'text-white/90' : 'text-gray-500 group-hover:text-white/90'}
                    `}>
                        {title}
                    </p>
                    <h3 className={`
                        font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-2.5 transition-colors duration-300
                        ${isActive ? 'text-white' : 'text-gray-900 group-hover:text-white'}
                    `}
                    >
                        {loading ? (
                            <div className="h-10 bg-muted rounded w-20 animate-pulse" />
                        ) : (
                            formattedValue
                        )}
                    </h3>

                    {trend && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {trend.isUp ? (
                                <TrendingUp className={`
                                    w-4 h-4 flex-shrink-0 transition-colors duration-300
                                    ${isActive ? 'text-white' : 'text-emerald-500 group-hover:text-white'}
                                `} />
                            ) : (
                                <TrendingDown className={`
                                    w-4 h-4 flex-shrink-0 transition-colors duration-300
                                    ${isActive ? 'text-white' : 'text-red-500 group-hover:text-white'}
                                `} />
                            )}
                            {trend.showPercentage !== false && (!trend.label || !trend.label.includes(`${Math.abs(trend.value)}%`)) && (
                                <span className={`
                                    text-sm font-semibold flex-shrink-0 transition-colors duration-300
                                    ${isActive
                                        ? 'text-white'
                                        : `${trend.isUp ? 'text-emerald-500' : 'text-red-500'} group-hover:text-white`
                                    }
                                `}>
                                    {Math.abs(trend.value)}%
                                </span>
                            )}
                            <span className={`
                                text-sm transition-colors duration-300
                                ${isActive ? 'text-white/80' : 'text-gray-500 group-hover:text-white/80'}
                            `}>
                                {trend.label || 'Up from yesterday'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
