import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isUp: boolean;
        label?: string;
    };
    iconBgColor?: string;
    iconColor?: string;
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    iconBgColor = 'bg-purple-100',
    iconColor = 'text-purple-600'
}: StatCardProps) {
    // Format large numbers with commas
    const formattedValue = typeof value === 'number'
        ? value.toLocaleString('en-US')
        : value;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
            {/* Icon in top-right corner */}
            <div className={`absolute top-6 right-6 w-14 h-14 ${iconBgColor} rounded-full flex items-center justify-center`}>
                <Icon className={`w-7 h-7 ${iconColor}`} />
            </div>

            {/* Content stacked vertically */}
            <div className="pr-16">
                <p className="text-sm text-gray-500 font-medium mb-2">{title}</p>
                <h3 className="text-4xl font-bold text-gray-900 mb-3">
                    {formattedValue}
                </h3>

                {trend && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {trend.isUp ? (
                            <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className={`text-sm font-semibold ${trend.isUp ? 'text-emerald-500' : 'text-red-500'} flex-shrink-0`}>
                            {Math.abs(trend.value)}%
                        </span>
                        <span className="text-sm text-gray-500">
                            {trend.label || 'Up from yesterday'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
