import React, { useState, useRef, useEffect } from 'react';
import { ReactPhotoSphereViewer } from 'react-photo-sphere-viewer';
import { Eye, ArrowDownToLine, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { uploadFile, supabase } from '../../lib/supabase';
import PanoramaPrivacyModal from './PanoramaPrivacyModal';

interface SanctuaryVirtualTourProps {
    churchId: string;
    churchName?: string;
    panoramaUrl?: string | null;
    canManage?: boolean;
    onPanoramaUpdated?: (newUrl: string) => void;
}

const FALLBACK_PANORAMA_URL = 'https://oaczurouvaevebpimply.supabase.co/storage/v1/object/public/church-images/panoramas/b2tabj6xh1v.jpg';

export default function SanctuaryVirtualTour({
    churchId,
    churchName,
    panoramaUrl,
    canManage = false,
    onPanoramaUpdated,
}: SanctuaryVirtualTourProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [pendingPrivacyFile, setPendingPrivacyFile] = useState<File | null>(null);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    const activePanoramaUrl = panoramaUrl || FALLBACK_PANORAMA_URL;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !churchId) return;

        // Open privacy modal to detect and blur people before uploading
        setPendingPrivacyFile(file);
        setShowPrivacyModal(true);
        if (e.target) e.target.value = '';
    };

    const handleConfirmPrivacyBlur = async (processedFile: File) => {
        setUploading(true);
        setFeedback(null);

        try {
            const fileExt = processedFile.name.split('.').pop() || 'jpg';
            const sanitizedBase = processedFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filePath = `panoramas/${churchId}_${Date.now()}_${sanitizedBase}.${fileExt}`;

            const publicUrl = await uploadFile('church-images', filePath, processedFile);

            const { error: updateError } = await supabase
                .from('churches')
                .update({ panorama_url: publicUrl })
                .eq('id', churchId);

            if (updateError) throw updateError;

            if (onPanoramaUpdated) {
                onPanoramaUpdated(publicUrl);
            }

            setFeedback({
                type: 'success',
                message: '360° sanctuary panorama privacy-blurred and updated successfully!',
            });
        } catch (err: unknown) {
            console.error('Error replacing panorama:', err);
            setFeedback({
                type: 'error',
                message: err instanceof Error ? err.message : 'Failed to replace panorama. Please try again.',
            });
        } finally {
            setUploading(false);
            setPendingPrivacyFile(null);
            setShowPrivacyModal(false);
        }
    };

    // Auto-dismiss feedback message after 4s
    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    return (
        <div className="card bg-white border border-border/80 shadow-2xs rounded-3xl p-5 sm:p-6 space-y-4">
            {/* Header matching Image 4 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                            360° virtual tour
                        </h2>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" /> Privacy Protected
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-secondary-500 mt-0.5">
                        Parishioners can look around the sanctuary (people inside are blurred for privacy)
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    <button
                        type="button"
                        onClick={() => {
                            if (!canManage) {
                                setFeedback({
                                    type: 'error',
                                    message: 'Only parish administrators can replace the sanctuary panorama.',
                                });
                                return;
                            }
                            fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                        className="bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer w-full sm:w-auto shrink-0 disabled:opacity-50"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <ArrowDownToLine className="w-4 h-4 text-secondary-600" />
                                <span>Replace panorama</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Notification / Feedback Banner */}
            {feedback && (
                <div
                    className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-all ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {feedback.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{feedback.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFeedback(null)}
                        className="text-xs opacity-60 hover:opacity-100 font-bold px-1"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Viewer Container */}
            <div className="h-[380px] sm:h-[420px] rounded-2xl overflow-hidden border border-border/60 relative bg-black/5">
                {/* Floating Top-Left Badge */}
                <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 text-primary border border-border/60 text-xs font-semibold shadow-xs backdrop-blur-xs pointer-events-none">
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    <span>Drag to look around</span>
                </div>

                {/* Direct Interactive 360 Photo Sphere Viewer */}
                <div className="w-full h-full relative" style={{ isolation: 'isolate' }}>
                    <ReactPhotoSphereViewer
                        src={activePanoramaUrl}
                        height={'100%'}
                        width={'100%'}
                        container={''}
                    />
                </div>
            </div>

            {/* Privacy Blur Modal */}
            {showPrivacyModal && pendingPrivacyFile && (
                <PanoramaPrivacyModal
                    isOpen={showPrivacyModal}
                    file={pendingPrivacyFile}
                    churchName={churchName}
                    onClose={() => {
                        setShowPrivacyModal(false);
                        setPendingPrivacyFile(null);
                    }}
                    onConfirm={handleConfirmPrivacyBlur}
                />
            )}
        </div>
    );
}
