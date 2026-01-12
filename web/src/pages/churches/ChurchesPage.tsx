import { Building2, Plus, Search, MapPin, MoreHorizontal } from 'lucide-react';

// Placeholder page - will be implemented fully later
export default function ChurchesPage() {
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Churches</h1>
                    <p className="text-muted">Manage parishes in your diocese</p>
                </div>
                <button className="btn-primary">
                    <Plus className="w-4 h-4" />
                    Add Church
                </button>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search churches..."
                        className="input pl-10"
                    />
                </div>
            </div>

            {/* Empty State */}
            <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                        <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No churches yet</h3>
                    <p className="text-muted text-center max-w-sm mb-6">
                        Get started by adding your first parish. You can manage their schedules, donations, and more.
                    </p>
                    <button className="btn-primary">
                        <Plus className="w-4 h-4" />
                        Add Your First Church
                    </button>
                </div>
            </div>
        </div>
    );
}
