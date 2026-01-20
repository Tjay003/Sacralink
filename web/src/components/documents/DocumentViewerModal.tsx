import { useState, useEffect } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';
import { getAppointmentDocuments, downloadDocument } from '../../lib/supabase/documents';

interface DocumentViewerModalProps {
    appointmentId: string;
    isOpen: boolean;
    onClose: () => void;
}

type DocumentWithRequirement = {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    file_size: number | null;
    uploaded_at: string;
    sacrament_requirements: {
        requirement_name: string;
    } | null;
};

export default function DocumentViewerModal({ appointmentId, isOpen, onClose }: DocumentViewerModalProps) {
    const [documents, setDocuments] = useState<DocumentWithRequirement[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchDocuments = async () => {
        setLoading(true);
        setError('');
        try {
            const docs = await getAppointmentDocuments(appointmentId);
            setDocuments(docs as any);
        } catch (err: any) {
            console.error('Error fetching documents:', err);
            setError('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    // Fetch documents when modal opens
    useEffect(() => {
        if (isOpen && appointmentId) {
            fetchDocuments();
        }
    }, [isOpen, appointmentId]);

    const handleDownload = (fileUrl: string, fileName: string) => {
        downloadDocument(fileUrl, fileName);
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown size';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold">Submitted Documents</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                            <p className="text-gray-500">Loading documents...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                            {error}
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No documents uploaded yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                                                <h3 className="font-medium text-gray-900 truncate">
                                                    {doc.sacrament_requirements?.requirement_name || 'Document'}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-gray-600 truncate mb-2">
                                                {doc.file_name}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>{formatFileSize(doc.file_size)}</span>
                                                <span>•</span>
                                                <span>Uploaded {formatDate(doc.uploaded_at)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <a
                                                href={doc.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary p-2"
                                                title="View"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={() => handleDownload(doc.file_url, doc.file_name)}
                                                className="btn-primary p-2"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
