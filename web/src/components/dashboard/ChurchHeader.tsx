import { useNavigate } from 'react-router-dom';
import { Building2, ExternalLink } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';

interface ChurchHeaderProps {
    churchId: string | null;
}

/**
 * ChurchHeader - Header showing church name and quick info for church admin dashboard
 * 
 * Features:
 * - Displays church name and subtitle
 * - Shows status badge
 * - View church details button
 */
export default function ChurchHeader({ churchId }: ChurchHeaderProps) {
    const navigate = useNavigate();
    const { churches, loading } = useChurches();

    // Find the church
    const church = churches.find(c => c.id === churchId);

    if (loading) {
        return (
            <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-muted rounded-lg animate-pulse" />
                        <div>
                            <div className="h-6 bg-muted rounded w-48 mb-2 animate-pulse" />
                            <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!church) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-red-600" />
                    <div>
                        <h3 className="font-semibold text-red-900">Church Not Found</h3>
                        <p className="text-sm text-red-700">Unable to load church information. Please contact an administrator.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
                {/* Church Info */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-1">{church.name}</h1>
                        <p className="text-blue-100 opacity-90">Your assigned parish</p>
                    </div>
                </div>

                {/* Actions & Status */}
                <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${church.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                        {church.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                    </span>

                    {/* View Details Button */}
                    <button
                        onClick={() => navigate(`/churches/${churchId}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-colors text-sm font-medium"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );
}
