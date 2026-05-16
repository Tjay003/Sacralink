import { useState } from 'react';
import { Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';
import AnnouncementCard from './AnnouncementCard';
import AnnouncementDetailModal from './AnnouncementDetailModal';

const PAGE_SIZE = 5;

interface AnnouncementsListProps {
    announcements: (ChurchAnnouncement | SystemAnnouncement)[];
    type: 'church' | 'system';
    showActions?: boolean;
    emptyMessage?: string;
    onEdit?: (announcement: ChurchAnnouncement | SystemAnnouncement) => void;
    onDelete?: (announcement: ChurchAnnouncement | SystemAnnouncement) => void;
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
 */
export default function AnnouncementsList({
    announcements,
    type,
    showActions = false,
    emptyMessage,
    onEdit,
    onDelete,
    initialOpenId,
}: AnnouncementsListProps) {
    const [page, setPage] = useState(0);
    const [viewing, setViewing] = useState<ChurchAnnouncement | SystemAnnouncement | null>(
        () => initialOpenId
            ? (announcements.find(a => a.id === initialOpenId) ?? null)
            : null
    );

    const totalPages = Math.ceil(announcements.length / PAGE_SIZE);
    const paginated = announcements.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    if (announcements.length === 0) {
        return (
            <div className="card p-8">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-secondary-100 flex items-center justify-center mb-4">
                        <Megaphone className="w-8 h-8 text-muted" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No announcements yet</h3>
                    <p className="text-muted max-w-sm">
                        {emptyMessage || 'There are no announcements to display at this time.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {paginated.map((announcement) => (
                    <AnnouncementCard
                        key={announcement.id}
                        announcement={announcement}
                        type={type}
                        showActions={showActions}
                        onView={() => setViewing(announcement)}
                        onEdit={onEdit ? () => onEdit(announcement) : undefined}
                        onDelete={onDelete ? () => onDelete(announcement) : undefined}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted">
                        Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, announcements.length)} of {announcements.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium px-2">{page + 1} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
