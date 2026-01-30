import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

interface DocumentUploaderProps {
    requirementId: string;
    requirementName: string;
    isRequired: boolean;
    allowedFileTypes?: string[];
    onFileSelect: (file: File) => void;
    onFileRemove: () => void;
    uploadedFile?: File | null;
    uploading?: boolean;
}

export default function DocumentUploader({
    requirementId: _requirementId,
    requirementName,
    isRequired,
    allowedFileTypes = ['pdf', 'jpg', 'jpeg', 'png'],
    onFileSelect,
    onFileRemove,
    uploadedFile,
    uploading = false
}: DocumentUploaderProps) {
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (file: File): string | null => {
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        // Check file type
        if (fileExt && !allowedFileTypes.includes(fileExt)) {
            return `Invalid file type. Allowed: ${allowedFileTypes.join(', ')}`;
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return `File too large. Maximum size: 10MB`;
        }

        return null;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const error = validateFile(file);
            if (error) {
                alert(error);
                return;
            }
            onFileSelect(file);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const error = validateFile(file);
            if (error) {
                alert(error);
                return;
            }
            onFileSelect(file);
        }
    };

    const handleClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium">
                {requirementName}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>

            {!uploadedFile ? (
                <div
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragActive
                        ? 'border-primary bg-primary-50'
                        : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={handleClick}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept={allowedFileTypes.map(ext => `.${ext}`).join(',')}
                        onChange={handleChange}
                    />

                    <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                        <span className="text-primary font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {allowedFileTypes.map(ext => ext.toUpperCase()).join(', ')} (Max 10MB)
                    </p>
                </div>
            ) : (
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {uploadedFile.name}
                            </p>
                            <p className="text-xs text-gray-500">
                                {(uploadedFile.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    </div>

                    {uploading ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFileRemove();
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
