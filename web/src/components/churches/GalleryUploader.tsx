import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface GalleryUploaderProps {
    churchId: string;
    onUploadComplete: () => void;
}

export default function GalleryUploader({ churchId, onUploadComplete }: GalleryUploaderProps) {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const files = Array.from(e.target.files);
        const validFiles = files.filter(file => {
            // Check file type
            if (!file.type.startsWith('image/')) {
                setError('Only image files are allowed');
                return false;
            }
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Image must be less than 5MB');
                return false;
            }
            return true;
        });

        setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 images
        setError('');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        setSelectedFiles(prev => [...prev, ...files].slice(0, 10));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setUploading(true);
        setError('');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get current max display_order
            const { data: existingImages } = await (supabase
                .from('church_images')
                .select('display_order')
                .eq('church_id', churchId)
                .order('display_order', { ascending: false })
                .limit(1) as any);

            let nextOrder = existingImages && existingImages.length > 0
                ? existingImages[0].display_order + 1
                : 0;

            // Upload each file
            for (const file of selectedFiles) {
                // Upload to storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${churchId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('church-images')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('church-images')
                    .getPublicUrl(filePath);

                const { error: dbError } = await supabase
                    .from('church_images')
                    .insert({
                        church_id: churchId,
                        image_url: publicUrl,
                        display_order: nextOrder++,
                        uploaded_by: user.id
                    });

                if (dbError) throw dbError;
            }

            setSelectedFiles([]);
            onUploadComplete();
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload images');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Dropzone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                    <span className="text-primary font-medium">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500">PNG, JPG, GIF up to 5MB (Max 10 images)</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Preview Grid */}
            {selectedFiles.length > 0 && (
                <div>
                    <h4 className="font-medium mb-3">Selected Images ({selectedFiles.length}/10)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-lg"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile(index);
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Upload Button */}
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="btn-primary w-full mt-4"
                    >
                        {uploading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Uploading...
                            </div>
                        ) : (
                            <>Upload {selectedFiles.length} Image{selectedFiles.length > 1 ? 's' : ''}</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
