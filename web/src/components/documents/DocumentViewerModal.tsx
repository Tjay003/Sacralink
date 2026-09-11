import { useState, useEffect } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { getAppointmentDocuments, downloadDocument } from '../../lib/supabase/documents';
import Modal from '../ui/Modal';

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

    useEffect(() => {
        if (isOpen && appointmentId) {
            fetchDocuments();
        }
    }, [isOpen, appointmentId]);

    const fetchDocuments = async () => {
        setLoading(true);
        setError('');
        try {
            const docs = await getAppointmentDocuments(appointmentId);
            setDocuments(docs as any);
        } catch (err: any) {
            console.error('Error fetching documents:', err);
            setError(err?.message || 'Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (fileUrl: string, fileName: string) => {
        try {
            await downloadDocument(fileUrl, fileName);
        } catch (err) {
            console.error('Error downloading:', err);
            window.open(fileUrl, '_blank');
        }
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-base sm:text-xl font-bold text-foreground break-words min-w-0">Submitted Documents</h2>
                </div>
            }
            size="3xl"
            footer={
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors shadow-sm"
                >
                    Close
                </button>
            }
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted">Loading documents...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl">
                    {error}
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted">No documents uploaded yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="border border-gray-200 rounded-xl p-4 hover:border-primary/50 transition-colors bg-white shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                                        <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">
                                            {doc.sacrament_requirements?.requirement_name || 'Document'}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-muted truncate mb-2">
                                        {doc.file_name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                                        <span className="font-medium">{formatFileSize(doc.file_size)}</span>
                                        <span>•</span>
                                        <span>Uploaded {formatDate(doc.uploaded_at)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                                        title="View"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(doc.file_url, doc.file_name)}
                                        className="p-2 rounded-lg bg-primary hover:bg-primary-600 text-white transition-colors shadow-sm"
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
        </Modal>
    );
}
