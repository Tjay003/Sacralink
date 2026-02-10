import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ExternalLink } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';

interface ChurchSelectorProps {
    selectedChurchId: string | null;
    onChurchSelect: (churchId: string | null) => void;
}

/**
 * ChurchSelector - Dropdown for selecting a church
 * 
 * Features:
 * - Shows only active churches
 * - Persists selection in localStorage
 * - Responsive dropdown design
 */
export default function ChurchSelector({ selectedChurchId, onChurchSelect }: ChurchSelectorProps) {
    const navigate = useNavigate();
    const { churches, loading } = useChurches();
    const [isOpen, setIsOpen] = useState(false);

    // Filter only active churches
    const activeChurches = churches.filter(c => c.status === 'active');

    // Find selected church details
    const selectedChurch = activeChurches.find(c => c.id === selectedChurchId);

    const handleSelect = (churchId: string | null) => {
        onChurchSelect(churchId);
        setIsOpen(false);
    };

    if (loading) {
        return (
            <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg animate-pulse" />
                    <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-32 mb-2 animate-pulse" />
                        <div className="h-3 bg-muted rounded w-48 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (activeChurches.length === 0) {
        return (
            <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Building2 className="w-5 h-5" />
                    <p className="text-sm">No churches available at the moment.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-foreground">Browse Churches</h3>
                    <p className="text-sm text-muted-foreground">Select a church to view announcements</p>
                </div>
            </div>

            {/* Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors"
                >
                    <span className="text-sm font-medium text-foreground">
                        {selectedChurch ? selectedChurch.name : 'Select a church'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* View Church Details Button */}
                {selectedChurch && (
                    <button
                        onClick={() => navigate(`/churches/${selectedChurchId}`)}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                        <ExternalLink className="w-4 h-4" />
                        View Church Details
                    </button>
                )}

                {/* Dropdown Menu */}
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Menu */}
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {/* Clear Selection */}
                            {selectedChurchId && (
                                <>
                                    <button
                                        onClick={() => handleSelect(null)}
                                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                                    >
                                        Clear selection
                                    </button>
                                    <div className="border-t" />
                                </>
                            )}

                            {/* Church List */}
                            {activeChurches.map((church) => (
                                <button
                                    key={church.id}
                                    onClick={() => handleSelect(church.id)}
                                    className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${selectedChurchId === church.id
                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 font-medium'
                                            : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                >
                                    <div className="font-medium">{church.name}</div>
                                    {church.address && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{church.address}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
