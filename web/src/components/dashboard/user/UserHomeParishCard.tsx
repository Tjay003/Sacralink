import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Church as ChurchIcon, Radio, ArrowLeftRight, ChevronDown, Check, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { Church } from '../../../hooks/useChurches';
import type { MassSchedule } from '../../../types/database';

interface UserHomeParishCardProps {
    church: Church | null;
    allChurches: Church[];
    favoriteChurchIds: string[];
    onSelectChurch: (churchId: string) => void;
}

export default function UserHomeParishCard({
    church,
    allChurches,
    favoriteChurchIds,
    onSelectChurch,
}: UserHomeParishCardProps) {
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [priestName, setPriestName] = useState<string | null>(null);
    const [nextMassText, setNextMassText] = useState<string>('Sunday · 8:00 AM');
    const confessionText = 'Fri 4:00 to 5:00 PM';
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    // Fetch parish priest and schedule for the selected church
    useEffect(() => {
        if (!church?.id) return;

        let cancelled = false;

        async function fetchParishDetails() {
            try {
                // 1. Fetch priest from profiles
                const { data: staff } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, is_priest')
                    .eq('assigned_church_id', church!.id);

                if (!cancelled && staff) {
                    const priest = staff.find((s) => s.is_priest || s.role === 'priest');
                    if (priest?.full_name) {
                        setPriestName(priest.full_name);
                    } else if (staff.length > 0 && staff[0].full_name) {
                        setPriestName(staff[0].full_name);
                    } else {
                        setPriestName('Parish Clergy Team');
                    }
                }

                // 2. Fetch mass schedule
                const { data: schedules } = await supabase
                    .from('mass_schedules')
                    .select('*')
                    .eq('church_id', church!.id);

                if (!cancelled && schedules && schedules.length > 0) {
                    // Pick the nearest Sunday or today schedule
                    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                    const todaySchedule = schedules.find((s: MassSchedule) => s.day_of_week.toLowerCase() === todayName.toLowerCase());
                    if (todaySchedule) {
                        setNextMassText(`Today · ${todaySchedule.time}`);
                    } else {
                        const sundaySchedule = schedules.find((s: MassSchedule) => s.day_of_week.toLowerCase() === 'sunday');
                        if (sundaySchedule) {
                            setNextMassText(`Sunday · ${sundaySchedule.time}`);
                        } else {
                            setNextMassText(`${schedules[0].day_of_week} · ${schedules[0].time}`);
                        }
                    }
                } else if (!cancelled) {
                    setNextMassText('Sunday · 8:00 AM');
                }
            } catch (err) {
                console.error('Error fetching home parish details:', err);
            }
        }

        fetchParishDetails();

        return () => {
            cancelled = true;
        };
    }, [church?.id]);

    // Determine the churches to show in the dropdown:
    // If the user has favorited churches, show those favorites.
    // If the user has no favorites yet, show all available churches so they are not stuck.
    const favoriteChurches = allChurches.filter(c => favoriteChurchIds.includes(c.id));
    const dropdownList = favoriteChurches.length > 0 ? favoriteChurches : allChurches;

    return (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs relative">
            {/* Header Badges */}
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-primary border border-blue-200">
                    <ChurchIcon className="w-3.5 h-3.5" />
                    My home parish
                </span>

                {church?.is_live && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 animate-pulse">
                        <Radio className="w-3.5 h-3.5" />
                        Live now
                    </span>
                )}
            </div>

            {/* Church Name */}
            <h2 className="text-xl font-serif font-bold text-foreground mt-3">
                {church?.name || 'Select a Church'}
            </h2>

            {/* Schedule details */}
            <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between items-baseline gap-2 py-1 border-b border-border/60">
                    <span className="text-secondary-600 font-medium">Next Mass</span>
                    <span className="font-semibold text-foreground text-right">{nextMassText}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2 py-1 border-b border-border/60">
                    <span className="text-secondary-600 font-medium">Confession</span>
                    <span className="font-semibold text-foreground text-right">{confessionText}</span>
                </div>
                <div className="flex justify-between items-baseline gap-2 py-1">
                    <span className="text-secondary-600 font-medium">Parish priest</span>
                    <span className="font-semibold text-foreground text-right">{priestName || 'Parish Clergy'}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 space-y-2.5">
                {church && (
                    <button
                        type="button"
                        onClick={() => navigate(`/churches/${church.id}`)}
                        className="w-full py-2.5 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                        <ChurchIcon className="w-4 h-4" />
                        View parish page
                    </button>
                )}

                {/* Dropdown container */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setDropdownOpen(prev => !prev)}
                        className="w-full py-2.5 px-4 rounded-xl border border-border bg-white hover:bg-secondary-50 text-sm font-semibold text-foreground transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowLeftRight className="w-4 h-4 text-secondary-500" />
                        <span>Change my parish</span>
                        <ChevronDown className={`w-4 h-4 text-secondary-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-border rounded-xl shadow-lg z-30 py-1.5 animate-in fade-in-50 zoom-in-95">
                            <div className="max-h-60 overflow-y-auto divide-y divide-border/60">
                                {dropdownList.map(item => {
                                    const isSelected = item.id === church?.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                onSelectChurch(item.id);
                                                setDropdownOpen(false);
                                            }}
                                            className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-2 hover:bg-secondary-50 transition-colors ${
                                                isSelected ? 'font-semibold text-primary bg-blue-50/50' : 'text-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <ChurchIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-primary' : 'text-secondary-400'}`} />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-primary shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Find another parish link */}
                            <div className="pt-1.5 mt-1 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDropdownOpen(false);
                                        navigate('/churches');
                                    }}
                                    className="w-full px-4 py-2 text-left text-xs font-semibold text-primary hover:bg-blue-50/50 flex items-center gap-2 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Find another parish
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
