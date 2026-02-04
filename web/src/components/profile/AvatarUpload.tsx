import { useState, useRef } from 'react';
import { Upload, X, Loader2, User } from 'lucide-react';
import { uploadAvatar, deleteAvatar } from '../../lib/supabase/profiles';
import { useAuth } from '../../contexts/AuthContext';

interface AvatarUploadProps {
    onUploadSuccess?: (url: string) => void;
    onDeleteSuccess?: () => void;
}

export default function AvatarUpload({ onUploadSuccess, onDeleteSuccess }: AvatarUploadProps) {
    const { profile, refreshProfile } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Invalid file type. Please upload JPG, PNG, or WEBP');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('File too large. Maximum size is 5MB');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        setUploading(true);
        try {
            const url = await uploadAvatar(file);
            await refreshProfile();
            onUploadSuccess?.(url);
            setPreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err: any) {
            setError(err.message || 'Failed to upload avatar');
            setPreview(null);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to remove your profile picture?')) {
            return;
        }

        setDeleting(true);
        setError(null);
        try {
            await deleteAvatar();
            await refreshProfile();
            onDeleteSuccess?.();
        } catch (err: any) {
            setError(err.message || 'Failed to delete avatar');
        } finally {
            setDeleting(false);
        }
    };

    const currentAvatar = preview || profile?.avatar_url;

    return (
        <div className="space-y-4">
            {/* Avatar Display */}
            <div className="flex items-center gap-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                        {currentAvatar ? (
                            <img
                                src={currentAvatar}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary-100">
                                <User className="w-12 h-12 text-primary" />
                            </div>
                        )}
                    </div>
                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || deleting}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            {profile?.avatar_url ? 'Change Photo' : 'Upload Photo'}
                        </button>

                        {profile?.avatar_url && (
                            <button
                                onClick={handleDelete}
                                disabled={uploading || deleting}
                                className="btn btn-outline flex items-center gap-2"
                            >
                                {deleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <X className="w-4 h-4" />
                                )}
                                Remove
                            </button>
                        )}
                    </div>

                    <p className="text-sm text-muted">
                        JPG, PNG or WEBP. Max size 5MB.
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Uploading Message */}
            {uploading && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    Compressing and uploading image...
                </div>
            )}
        </div>
    );
}
