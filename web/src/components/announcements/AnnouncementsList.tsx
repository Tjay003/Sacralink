import { Megaphone } from 'lucide-react';
import type { ChurchAnnouncement, SystemAnnouncement } from '../../types/database';
import AnnouncementCard from './AnnouncementCard';

interface AnnouncementsListProps {
    announcements: (ChurchAnnouncement | SystemAnnouncement)[];
    type: 'church' | 'system';
    showActions?: boolean;
    emptyMessage?: string;
    onEdit?: (announcement: ChurchAnnouncement | SystemAnnouncement) => void;
    onDelete?: (announcement: ChurchAnnouncement | SystemAnnouncement) => void;
}

/**
 * AnnouncementsList - Display a list of announcements
 * 
 * Features:
 * - Displays announcements in cards
 * - Empty state
 * - Passes edit/delete actions to cards
 */
export default function AnnouncementsList({
    announcements,
    type,
    showActions = false,
    emptyMessage,
    onEdit,
    onDelete,
}: AnnouncementsListProps) {
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
        <div className="space-y-4">
            {announcements.map((announcement) => (
                <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    type={type}
                    showActions={showActions}
                    onEdit={onEdit ? () => onEdit(announcement) : undefined}
                    onDelete={onDelete ? () => onDelete(announcement) : undefined}
                />
            ))}
        </div>
    );
}
