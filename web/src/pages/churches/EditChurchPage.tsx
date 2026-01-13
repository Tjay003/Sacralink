import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useChurch } from '../../hooks/useChurches';
import { Building2, ArrowLeft } from 'lucide-react';

/**
 * EditChurchPage - Form to edit an existing church
 * 
 * Features:
 * - Pre-fill form with current church data
 * - Same validation as add form
 * - Update database on save
 * - Navigate back to detail page after save
 */
import { useAuth } from '../../contexts/AuthContext';
// ... rest of imports

export default function EditChurchPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { church, loading: loadingChurch } = useChurch(id);

    const [loading, setLoading] = useState(false);

    // Redirect if not admin
    if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
        navigate('/churches');
        return null;
    }

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_number: '',
        email: '',
        description: '',
        panorama_url: '',
        livestream_url: '',
    });

    // Pre-fill form when church data loads
    useEffect(() => {
        if (church) {
            setFormData({
                name: church.name || '',
                address: church.address || '',
                contact_number: church.contact_number || '',
                email: church.email || '',
                description: church.description || '',
                panorama_url: church.panorama_url || '',
                livestream_url: church.livestream_url || '',
            });
        }
    }, [church]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log('📝 Updating church...');

        // Validation
        if (!formData.name.trim()) {
            setError('Church name is required');
            return;
        }

        if (!formData.address.trim()) {
            setError('Address is required');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        if (!id) return;

        try {
            // Update in database
            const { error: updateError } = await (supabase
                .from('churches') as any)
                .update({
                    name: formData.name.trim(),
                    address: formData.address.trim(),
                    contact_number: formData.contact_number.trim() || null,
                    email: formData.email.trim() || null,
                    description: formData.description.trim() || null,
                    panorama_url: formData.panorama_url.trim() || null,
                    livestream_url: formData.livestream_url.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (updateError) {
                console.error('❌ Error updating church:', updateError);
                setError(updateError.message);
                setLoading(false);
                return;
            }

            console.log('✅ Church updated successfully');
            setSuccess('Church updated successfully!');

            // Navigate back to detail page after 1 second
            setTimeout(() => {
                navigate(`/churches/${id}`);
            }, 1000);

        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to update church');
            setLoading(false);
        }
    };

    // Loading state
    if (loadingChurch) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading church...</p>
                </div>
            </div>
        );
    }

    // Church not found
    if (!church) {
        return (
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/churches')}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Churches
                </button>
                <div className="card p-6">
                    <div className="text-center text-red-600">
                        <p className="font-semibold mb-2">Church not found</p>
                        <p className="text-sm">This church does not exist</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate(`/churches/${id}`)}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Church Details
                </button>
                <h1 className="text-2xl font-bold">Edit Church</h1>
                <p className="text-muted">Update church information</p>
            </div>

            {/* Form Card */}
            <div className="card p-6">
                {/* Success Message */}
                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-600">{success}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Church Icon */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <p className="font-semibold">{church.name}</p>
                            <p className="text-sm text-muted">Update church information</p>
                        </div>
                    </div>

                    {/* Church Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Church Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., St. Peter Parish"
                            required
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="Full address of the church"
                            rows={3}
                            required
                        />
                    </div>

                    {/* Contact Number */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Contact Number
                        </label>
                        <input
                            type="tel"
                            value={formData.contact_number}
                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., +63 912 345 6789"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., info@stpeter.church"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="Brief description of the church"
                            rows={4}
                        />
                    </div>

                    {/* Panorama URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            360° Panorama URL
                        </label>
                        <input
                            type="url"
                            value={formData.panorama_url}
                            onChange={(e) => setFormData({ ...formData, panorama_url: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., https://..."
                        />
                        <p className="text-xs text-muted mt-1">
                            Link to 360° virtual tour (optional)
                        </p>
                    </div>

                    {/* Livestream URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Livestream URL
                        </label>
                        <input
                            type="url"
                            value={formData.livestream_url}
                            onChange={(e) => setFormData({ ...formData, livestream_url: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., https://youtube.com/..."
                        />
                        <p className="text-xs text-muted mt-1">
                            Link to live mass stream (optional)
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${id}`)}
                            disabled={loading}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
