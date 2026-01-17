import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Building2, ArrowLeft } from 'lucide-react';

/**
 * AddChurchPage - Form to create a new church
 * 
 * Features:
 * - Form with all church fields
 * - Validation (required fields)
 * - Insert into database
 * - Success/error feedback
 * - Navigate back after save
 */
import { useAuth } from '../../contexts/AuthContext';
// ... rest of imports

export default function AddChurchPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Redirect if not admin
    if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
        navigate('/churches');
        return null;
    }

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_number: '',
        email: '',
        description: '',
        panorama_url: '',
        livestream_url: '',
        facebook_url: '',
    });

    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) {
            return;
        }

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `panoramas/${fileName}`;

        setUploading(true);
        setError('');

        try {
            const { error: uploadError } = await (supabase.storage
                .from('church-images') as any) // Type assertion due to outdated types
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data } = supabase.storage
                .from('church-images')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, panorama_url: data.publicUrl }));
            console.log('✅ Image uploaded:', data.publicUrl);
        } catch (err: any) {
            console.error('❌ Error uploading image:', err);
            setError('Failed to upload image: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log('📝 Submitting church form...');

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

        try {
            // Insert into database
            const { data, error: insertError } = await (supabase
                .from('churches') as any)
                .insert([{
                    name: formData.name.trim(),
                    address: formData.address.trim(),
                    contact_number: formData.contact_number.trim() || null,
                    email: formData.email.trim() || null,
                    description: formData.description.trim() || null,
                    panorama_url: formData.panorama_url.trim() || null,
                    livestream_url: formData.livestream_url.trim() || null,
                    facebook_url: formData.facebook_url.trim() || null,
                }])
                .select()
                .single();

            if (insertError) {
                console.error('❌ Error inserting church:', insertError);
                setError(insertError.message);
                setLoading(false);
                return;
            }

            console.log('✅ Church created:', data);
            setSuccess('Church created successfully!');

            // Navigate to church detail page after 1 second
            setTimeout(() => {
                navigate(`/churches/${(data as any).id}`);
            }, 1000);

        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to create church');
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/churches')}
                    className="flex items-center text-muted hover:text-foreground mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Churches
                </button>
                <h1 className="text-2xl font-bold">Add New Church</h1>
                <p className="text-muted">Create a new parish in your diocese</p>
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
                            <p className="font-semibold">Church Information</p>
                            <p className="text-sm text-muted">Fill in the details below</p>
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

                    {/* Facebook URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Official Facebook Page
                        </label>
                        <input
                            type="url"
                            value={formData.facebook_url}
                            onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., https://facebook.com/mychurch"
                        />
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

                    {/* 360° Panorama Image Upload */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            360° Panorama Image
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={loading || uploading}
                                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary hover:file:bg-primary-100"
                            />
                        </div>
                        {uploading && <p className="text-xs text-primary mt-2">Uploading image...</p>}
                        {formData.panorama_url && !uploading && (
                            <p className="text-xs text-green-600 mt-2">✓ Image uploaded successfully</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                            Upload an equirectangular image for the 360° tour.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={() => navigate('/churches')}
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
                            {loading ? 'Creating...' : 'Create Church'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
