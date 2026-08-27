import { useState } from 'react';
import { Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import type {
    ChurchAnnouncement,
    SystemAnnouncement,
    UnifiedAnnouncement,
} from '../../lib/supabase/announcements';
import AnnouncementCard from './AnnouncementCard';
import AnnouncementDetailModal from './AnnouncementDetailModal';

const PAGE_SIZE = 5;

interface AnnouncementsListProps {
    announcements: (ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement)[];
    type?: 'church' | 'system' | 'all';
    showActions?: boolean;
    emptyMessage?: string;
    canEditItem?: (item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => boolean;
    canDeleteItem?: (item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => boolean;
    onEdit?: (announcement: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => void;
    onDelete?: (announcement: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => void;
    /** If set, automatically opens this announcement ID in the modal on mount */
    initialOpenId?: string | null;
}

/**
 * AnnouncementsList - Paginated list of announcements with detail modal
 *
 * Features:
 * - 5-per-page pagination
 * - Click any card → AnnouncementDetailModal
 * - initialOpenId: auto-opens a specific announcement (for notification deep-links)
 * - Flexible item-level action permissions (canEditItem, canDeleteItem)
 */
export default function AnnouncementsList({
    announcements,
    type = 'all',
    showActions = false,
    emptyMessage,
    canEditItem,
    canDeleteItem,
    onEdit,
    onDelete,
    initialOpenId,
}: AnnouncementsListProps) {
    const [page, setPage] = useState(0);
    const [viewing, setViewing] = useState<ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement | null>(
        () => initialOpenId
            ? (announcements.find(a => a.id === initialOpenId) ?? null)
            : null
    );

    const totalPages = Math.max(1, Math.ceil(announcements.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const paginated = announcements.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    if (announcements.length === 0) {
        return (
            <div className="card p-8">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-secondary-100 flex items-center justify-center mb-4">
                        <Megaphone className="w-8 h-8 text-muted" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">No announcements yet</h3>
                    <p className="text-muted max-w-sm text-sm">
                        {emptyMessage || 'There are no announcements to display at this time.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {paginated.map((announcement) => {
                    const itemCanEdit = onEdit && (!canEditItem || canEditItem(announcement));
                    const itemCanDelete = onDelete && (!canDeleteItem || canDeleteItem(announcement));

                    return (
                        <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            type={type}
                            showActions={showActions && Boolean(itemCanEdit || itemCanDelete)}
                            onView={() => setViewing(announcement)}
                            onEdit={itemCanEdit ? () => onEdit(announcement) : undefined}
                            onDelete={itemCanDelete ? () => onDelete(announcement) : undefined}
                        />
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted">
                        Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, announcements.length)} of {announcements.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={safePage === 0}
                            className="p-2 rounded-lg border border-border hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium px-2 text-foreground">{safePage + 1} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={safePage >= totalPages - 1}
                            className="p-2 rounded-lg border border-border hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-foreground"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {viewing && (
                <AnnouncementDetailModal
                    announcement={viewing}
                    type={type}
                    onClose={() => setViewing(null)}
                />
            )}
        </>
    );
}
