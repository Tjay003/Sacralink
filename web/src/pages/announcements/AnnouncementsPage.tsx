import { Megaphone, Plus, Search } from 'lucide-react';

export default function AnnouncementsPage() {
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
                    <p className="text-muted">Share news and updates with parishioners</p>
                </div>
                <button className="btn-primary">
                    <Plus className="w-4 h-4" />
                    New Announcement
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                    type="text"
                    placeholder="Search announcements..."
                    className="input pl-10"
                />
            </div>

            {/* Empty State */}
            <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                        <Megaphone className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No announcements</h3>
                    <p className="text-muted text-center max-w-sm mb-6">
                        Create announcements to share important news, events, and updates with your parishioners.
                    </p>
                    <button className="btn-primary">
                        <Plus className="w-4 h-4" />
                        Create Your First Announcement
                    </button>
                </div>
            </div>
        </div>
    );
}
