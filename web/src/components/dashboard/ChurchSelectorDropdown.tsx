import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Building2, Check } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';

interface ChurchSelectorDropdownProps {
    selectedChurchId: string | null;
    onChurchSelect: (churchId: string | null) => void;
}

/**
 * ChurchSelectorDropdown - Dropdown for super admins to select a church
 * 
 * Features:
 * - "All Churches" option (default)
 * - Individual church options with status badges
 * - Search/filter capability
 * - Maintains existing color scheme
 */
export default function ChurchSelectorDropdown({ selectedChurchId, onChurchSelect }: ChurchSelectorDropdownProps) {
    const { churches, loading } = useChurches();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter churches based on search query
    const filteredChurches = churches.filter(church =>
        church.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        church.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get selected church name
    const selectedChurch = churches.find(c => c.id === selectedChurchId);
    const displayText = selectedChurch ? selectedChurch.name : 'All Churches';

    const handleSelect = (churchId: string | null) => {
        onChurchSelect(churchId);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div ref={dropdownRef} className="relative w-full max-w-md">
            {/* Dropdown Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-white" />
                    <span className="text-sm font-medium text-white">
                        {loading ? 'Loading...' : displayText}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-background border rounded-lg shadow-lg max-h-96 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b bg-background">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search churches..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-64 overflow-y-auto">
                        {/* All Churches Option */}
                        <button
                            onClick={() => handleSelect(null)}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors text-left ${selectedChurchId === null ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <div>
                                    <div className="text-sm font-medium text-foreground">All Churches</div>
                                    <div className="text-xs text-gray-600">Diocese-wide view</div>
                                </div>
                            </div>
                            {selectedChurchId === null && (
                                <Check className="w-4 h-4 text-blue-600" />
                            )}
                        </button>

                        {/* Divider */}
                        <div className="border-t my-1" />

                        {/* Individual Churches */}
                        {filteredChurches.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                No churches found
                            </div>
                        ) : (
                            filteredChurches.map((church) => (
                                <button
                                    key={church.id}
                                    onClick={() => handleSelect(church.id)}
                                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors text-left ${selectedChurchId === church.id ? 'bg-blue-50' : ''
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-foreground truncate">
                                                {church.name}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${church.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {church.status}
                                            </span>
                                        </div>
                                        {church.address && (
                                            <div className="text-xs text-gray-600 truncate">
                                                {church.address}
                                            </div>
                                        )}
                                    </div>
                                    {selectedChurchId === church.id && (
                                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
