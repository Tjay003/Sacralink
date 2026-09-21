import { useState } from 'react';
import {
    Video,
    Copy,
    Check,
    ShieldCheck,
    Maximize2,
    Minimize2,
    PhoneOff,
    ExternalLink,
} from 'lucide-react';
import Modal from '../ui/Modal';

export interface VideoConferenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomName: string;
    conversationTitle?: string;
    participantName?: string;
}

export default function VideoConferenceModal({
    isOpen,
    onClose,
    roomName,
    conversationTitle = 'Parish Video Conference',
    participantName = 'Parishioner',
}: VideoConferenceModalProps) {
    const [copied, setCopied] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [iframeLoaded, setIframeLoaded] = useState(false);

    if (!isOpen || !roomName) return null;

    // Clean and encode room parameters
    const safeRoom = encodeURIComponent(roomName.trim());
    const safeDisplayName = encodeURIComponent(participantName.trim());

    // Jitsi meet URL configuration
    const toolbarButtons = encodeURIComponent(
        "['microphone','camera','closedcaptions','desktop','fullscreen','fodeviceselection','hangup','chat','settings','raisehand','videoquality','filmstrip','tileview']"
    );
    const jitsiUrl = `https://meet.jit.si/${safeRoom}#userInfo.displayName="${safeDisplayName}"&config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.TOOLBAR_BUTTONS=${toolbarButtons}`;
    const directShareLink = `https://meet.jit.si/${safeRoom}`;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(directShareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error('Failed to copy meeting link:', err);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size={isFullscreen ? 'full' : '4xl'}
            showCloseButton={false}
            closeOnBackdropClick={false}
            className={
                isFullscreen
                    ? 'w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden shadow-2xl'
                    : 'w-full max-w-6xl h-[85vh] sm:h-[90vh] max-h-[94vh] flex flex-col overflow-hidden shadow-2xl'
            }
            bodyClassName="p-0 flex-1 min-h-0 flex flex-col overflow-hidden"
            header={
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <Video className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-foreground truncate">
                                    {conversationTitle}
                                </h2>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    Live Room
                                </span>
                            </div>
                            <p className="text-xs text-muted truncate">
                                Room: <span className="font-mono text-foreground/80">{roomName}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Copy Meeting Link */}
                        <button
                            type="button"
                            onClick={handleCopyLink}
                            aria-label="Copy Link"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary-100 hover:bg-secondary-200 text-secondary-800 transition-colors cursor-pointer"
                            title="Copy link to invite others"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-semibold">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-muted" />
                                    <span>Copy Link</span>
                                </>
                            )}
                        </button>

                        {/* Open external link in new tab */}
                        <a
                            href={directShareLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-secondary-100 transition-colors"
                            title="Open in new tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Fullscreen Toggle */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-secondary-100 transition-colors"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                            ) : (
                                <Maximize2 className="w-4 h-4" />
                            )}
                        </button>

                        {/* Hangup / Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors ml-1"
                            title="Leave Meeting"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                            <span>Leave</span>
                        </button>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full text-xs text-muted">
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            End-to-End Encrypted Peer Audio/Video
                        </span>
                        <span className="hidden sm:inline text-muted">• Zero Server Data Storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-secondary-700 bg-secondary-100 hover:bg-secondary-200 transition-colors"
                        >
                            Close Meeting Window
                        </button>
                    </div>
                </div>
            }
        >
            <div className="relative flex-1 min-h-0 w-full h-full bg-slate-950 flex flex-col overflow-hidden">
                {/* Loading Skeleton */}
                {!iframeLoaded && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center text-primary">
                                <Video className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-200">Connecting to secure room...</p>
                            <p className="text-xs text-slate-400 mt-0.5">{roomName}</p>
                        </div>
                    </div>
                )}

                {/* Embedded Jitsi Meeting IFrame */}
                <iframe
                    src={jitsiUrl}
                    title={`Video Conference - ${conversationTitle}`}
                    allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
                    onLoad={() => setIframeLoaded(true)}
                    className="w-full h-full min-h-0 border-0 flex-1"
                    style={{ minHeight: '100%', height: '100%', width: '100%' }}
                />
            </div>
        </Modal>
    );
}
