import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import type {
    ChurchAnnouncement,
    SystemAnnouncement,
    UnifiedAnnouncement,
} from '../../lib/supabase/announcements';
import AnnouncementCard from './AnnouncementCard';
import AnnouncementDetailModal from './AnnouncementDetailModal';
import Pagination from '../common/Pagination';

const DEFAULT_PAGE_SIZE = 5;

export interface AnnouncementsListProps {
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
    /** Optional parent or server controlled pagination */
    currentPage?: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
}

/**
 * AnnouncementsList - Paginated list of announcements with detail modal
 *
 * Features:
 * - Shared Pagination component with 5/10/20 items per page
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
    currentPage: propsCurrentPage,
    pageSize: propsPageSize,
    totalItems: propsTotalItems,
    onPageChange: propsOnPageChange,
    onPageSizeChange: propsOnPageSizeChange,
}: AnnouncementsListProps) {
    const [internalPage, setInternalPage] = useState(1);
    const [internalPageSize, setInternalPageSize] = useState(DEFAULT_PAGE_SIZE);

    const currentPage = propsCurrentPage ?? internalPage;
    const pageSize = propsPageSize ?? internalPageSize;
    const onPageChange = propsOnPageChange ?? setInternalPage;
    const onPageSizeChange = propsOnPageSizeChange ?? setInternalPageSize;
    const totalItems = propsTotalItems ?? announcements.length;

    const [viewing, setViewing] = useState<ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement | null>(
        () => initialOpenId
            ? (announcements.find(a => a.id === initialOpenId) ?? null)
            : null
    );

    const isServerPaginated = propsTotalItems !== undefined && propsTotalItems > announcements.length;
    const paginated = isServerPaginated
        ? announcements
        : announcements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (announcements.length === 0) {
        return (
            <div className="text-center py-12 text-muted bg-secondary-50/50 rounded-2xl border border-dashed border-border mt-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 mx-auto">
                    <Megaphone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-bold text-foreground mb-1">No announcements yet</h3>
                <p className="text-secondary-500 max-w-sm text-xs sm:text-sm mx-auto">
                    {emptyMessage || 'There are no announcements to display at this time.'}
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="divide-y divide-border/60 border-t border-border/60 mt-4">
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

            {/* Shared Pagination Component */}
            {totalItems > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    pageSizeOptions={[5, 10, 20]}
                    itemName="announcements"
                    className="mt-6"
                />
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
