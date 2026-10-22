import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Building2, Check } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';

interface ChurchSelectorDropdownProps {
    selectedChurchId: string | null;
    onChurchSelect: (churchId: string | null) => void;
    variant?: 'light' | 'dark';
    allLabel?: string;
}

/**
 * ChurchSelectorDropdown - Dropdown for super admins to select a church
 * 
 * Features:
 * - "All parishes" option (default)
 * - Individual church options with status badges
 * - Search/filter capability
 * - Supports light card and dark theme variants
 */
export default function ChurchSelectorDropdown({
    selectedChurchId,
    onChurchSelect,
    variant = 'light',
    allLabel = 'All parishes',
}: ChurchSelectorDropdownProps) {
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
    const displayText = selectedChurch ? selectedChurch.name : allLabel;

    const handleSelect = (churchId: string | null) => {
        onChurchSelect(churchId);
        setIsOpen(false);
        setSearchQuery('');
    };

    const isLight = variant === 'light';

    return (
        <div ref={dropdownRef} className="relative w-full">
            {/* Dropdown Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 ${
                    isLight
                        ? 'bg-white hover:bg-secondary-50 border border-border text-foreground shadow-xs'
                        : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-primary' : 'text-white'}`} />
                    <span className={`text-xs sm:text-sm font-semibold truncate ${isLight ? 'text-foreground' : 'text-white'}`}>
                        {loading ? 'Loading...' : displayText}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isLight ? 'text-secondary-500' : 'text-white'} ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 z-[100] w-full sm:min-w-[380px] lg:min-w-[420px] max-w-[calc(100vw-2rem)] mt-2 bg-white border border-border/80 rounded-2xl shadow-2xl max-h-96 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
                    {/* Search Input */}
                    <div className="p-3 border-b bg-background">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search churches..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full !pl-10 pr-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                    </div>


                    {/* Options List */}
                    <div className="max-h-64 overflow-y-auto">
                        {/* All Churches Option */}
                        <button
                            onClick={() => handleSelect(null)}
                            className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left group ${
                                selectedChurchId === null
                                    ? 'bg-blue-50 border-l-2 border-blue-500'
                                    : 'hover:bg-blue-50/60 border-l-2 border-transparent'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    selectedChurchId === null ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-blue-100'
                                }`}>
                                    <Building2 className={`w-4 h-4 transition-colors ${
                                        selectedChurchId === null ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'
                                    }`} />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-foreground">{allLabel}</div>
                                    <div className="text-xs text-gray-500">All churches</div>
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
                                    className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left group ${
                                        selectedChurchId === church.id
                                            ? 'bg-blue-50 border-l-2 border-blue-500'
                                            : 'hover:bg-blue-50/60 border-l-2 border-transparent'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-sm font-medium truncate transition-colors ${
                                                selectedChurchId === church.id ? 'text-blue-700' : 'text-foreground group-hover:text-blue-700'
                                            }`}>
                                                {church.name}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 uppercase tracking-wide ${
                                                church.status === 'verified_active'
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                    : church.status === 'active'
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}>
                                                {church.status === 'verified_active' ? 'Verified' : church.status}
                                            </span>
                                        </div>
                                        {church.address && (
                                            <div className="text-xs text-secondary-500 truncate">
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
