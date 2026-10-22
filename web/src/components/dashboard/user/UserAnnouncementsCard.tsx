import { useState, useEffect } from 'react';
import { Church, Megaphone, Bell, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { getAllAnnouncements, type UnifiedAnnouncement } from '../../../lib/supabase/announcements';
import Modal from '../../ui/Modal';

interface UserAnnouncementsCardProps {
    churchId?: string | null;
    churchName?: string | null;
}

export default function UserAnnouncementsCard({ churchId, churchName }: UserAnnouncementsCardProps) {
    const [announcements, setAnnouncements] = useState<UnifiedAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<UnifiedAnnouncement | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchAll() {
            setLoading(true);
            try {
                const res = await getAllAnnouncements({
                    churchId: churchId || undefined,
                    limit: 6,
                });

                if (!cancelled) {
                    setAnnouncements(res.data || []);
                }
            } catch (err) {
                console.error('Error fetching combined announcements:', err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchAll();

        return () => {
            cancelled = true;
        };
    }, [churchId]);

    return (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border/80">
                <div>
                    <h3 className="font-semibold text-lg text-foreground">
                        News and announcements
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                        From your parish and SacraLink
                    </p>
                </div>
                {announcements.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-700">
                        {announcements.length} updates
                    </span>
                )}
            </div>

            {/* List in row format */}
            {loading ? (
                <div className="space-y-3 py-2">
                    <div className="h-16 bg-secondary-100/60 rounded-xl animate-pulse" />
                    <div className="h-16 bg-secondary-100/60 rounded-xl animate-pulse" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="text-center py-6 text-muted text-xs">
                    <Bell className="w-6 h-6 mx-auto mb-1.5 text-secondary-400" />
                    No announcements posted at this time.
                </div>
            ) : (
                <div className="divide-y divide-border">
                    {announcements.map(item => {
                        let formattedDate = 'Recent';
                        try {
                            if (item.created_at) {
                                formattedDate = format(new Date(item.created_at), 'MMM d');
                            }
                        } catch {
                            formattedDate = 'Recent';
                        }

                        const isChurch = item.kind === 'church';

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left py-3.5 first:pt-1 last:pb-1 flex items-start gap-3.5 hover:bg-secondary-50/70 -mx-2 px-2 rounded-xl transition-colors group cursor-pointer"
                            >
                                {/* Left icon */}
                                <div className="mt-0.5 shrink-0">
                                    {isChurch ? (
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Church className="w-5 h-5" />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                            <Megaphone className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h4>
                                        <span className="text-xs text-secondary-500 shrink-0">
                                            {formattedDate}
                                        </span>
                                    </div>

                                    {item.content && (
                                        <p className="text-xs text-secondary-600 line-clamp-2 mt-1 leading-relaxed">
                                            {item.content}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between gap-2 mt-1.5">
                                        <span className="text-[11px] font-medium text-muted">
                                            {isChurch ? (churchName || 'Home Parish') : 'System announcement'}
                                        </span>
                                        <span className="text-xs font-semibold text-primary inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Read more
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Read Announcement Modal */}
            {selectedItem && (
                <Modal
                    isOpen={Boolean(selectedItem)}
                    onClose={() => setSelectedItem(null)}
                    title={selectedItem.title}
                >
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted pb-3 border-b border-border">
                            {selectedItem.kind === 'church' ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                    <Church className="w-3.5 h-3.5" />
                                    {churchName || 'Parish Announcement'}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                    <Megaphone className="w-3.5 h-3.5" />
                                    System Announcement
                                </span>
                            )}
                            <span>·</span>
                            <span>
                                {selectedItem.created_at
                                    ? format(new Date(selectedItem.created_at), 'MMMM d, yyyy')
                                    : 'Recent'}
                            </span>
                        </div>

                        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {selectedItem.content}
                        </div>

                        <div className="pt-3 border-t border-border flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-secondary-100 hover:bg-secondary-200 text-secondary-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
