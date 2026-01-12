import { Heart, Search, Filter } from 'lucide-react';

export default function DonationsPage() {
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Donations</h1>
                    <p className="text-muted">Verify and manage cashless donations</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary">
                    Pending (0)
                </button>
                <button className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">
                    Verified
                </button>
                <button className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground">
                    All
                </button>
            </div>

            {/* Search */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by name or reference..."
                        className="input pl-10"
                    />
                </div>
                <button className="btn-outline">
                    <Filter className="w-4 h-4" />
                    Filters
                </button>
            </div>

            {/* Empty State */}
            <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                        <Heart className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No pending donations</h3>
                    <p className="text-muted text-center max-w-sm">
                        When parishioners submit donation proofs, they will appear here for verification.
                    </p>
                </div>
            </div>
        </div>
    );
}
