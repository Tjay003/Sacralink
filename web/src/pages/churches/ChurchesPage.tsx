import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, MapPin, Phone, Mail } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ChurchesPage - List all churches
 * 
 * Features:
 * - Display all churches in a table
 * - Search churches by name
 * - Navigate to add/edit/view pages
 * - Loading and error states
 */
export default function ChurchesPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { churches, loading, error } = useChurches();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter churches by search query
    const filteredChurches = churches.filter(church =>
        church.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        church.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading churches...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="card p-6">
                <div className="text-center text-red-600">
                    <p className="font-semibold mb-2">Error loading churches</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Churches</h1>
                    <p className="text-muted">Manage parishes in your diocese</p>
                </div>
                {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                    <button
                        onClick={() => navigate('/churches/add')}
                        className="btn-primary"
                    >
                        <Plus className="w-4 h-4" />
                        Add Church
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search churches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
            </div>

            {/* Empty State */}
            {churches.length === 0 ? (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No churches yet</h3>
                        <p className="text-muted text-center max-w-sm mb-6">
                            Get started by adding your first parish. You can manage their schedules, donations, and more.
                        </p>
                        <button
                            onClick={() => navigate('/churches/add')}
                            className="btn-primary"
                        >
                            <Plus className="w-4 h-4" />
                            Add Your First Church
                        </button>
                    </div>
                </div>
            ) : (
                /* Churches Table */
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-secondary-50 border-b border-border">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                        Church
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                        Location
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                        Contact
                                    </th>
                                    {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-border">
                                {filteredChurches.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-muted">
                                            No churches found matching "{searchQuery}"
                                        </td>
                                    </tr>
                                ) : (
                                    filteredChurches.map((church) => (
                                        <tr
                                            key={church.id}
                                            className="hover:bg-secondary-50 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/churches/${church.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                                        <Building2 className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-foreground">
                                                            {church.name}
                                                        </div>
                                                        {church.description && (
                                                            <div className="text-sm text-muted line-clamp-1">
                                                                {church.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-sm text-foreground">
                                                    <MapPin className="w-4 h-4 text-muted mr-2" />
                                                    {church.address}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    {church.contact_number && (
                                                        <div className="flex items-center text-sm text-foreground">
                                                            <Phone className="w-4 h-4 text-muted mr-2" />
                                                            {church.contact_number}
                                                        </div>
                                                    )}
                                                    {church.email && (
                                                        <div className="flex items-center text-sm text-foreground">
                                                            <Mail className="w-4 h-4 text-muted mr-2" />
                                                            {church.email}
                                                        </div>
                                                    )}
                                                    {!church.contact_number && !church.email && (
                                                        <span className="text-sm text-muted">No contact info</span>
                                                    )}
                                                </div>
                                            </td>
                                            {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/churches/${church.id}/edit`);
                                                        }}
                                                        className="btn-secondary text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Results Count */}
                    {filteredChurches.length > 0 && (
                        <div className="px-6 py-3 border-t border-border bg-secondary-50">
                            <p className="text-sm text-muted">
                                Showing {filteredChurches.length} of {churches.length} churches
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
