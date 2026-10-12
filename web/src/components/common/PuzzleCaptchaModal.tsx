import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface PuzzleCaptchaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (token: string) => void;
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 160;
const PIECE_SIZE = 44;
const TOLERANCE_PX = 6;

// Color themes for stained glass / cathedral artistic backgrounds
const THEMES = [
    { name: 'Cathedral Dawn', bg1: '#1E3A8A', bg2: '#3B82F6', accent: '#F59E0B' },
    { name: 'Sacred Gold', bg1: '#78350F', bg2: '#D97706', accent: '#FDE68A' },
    { name: 'Eucharistic Blue', bg1: '#1E1B4B', bg2: '#4338CA', accent: '#60A5FA' },
    { name: 'Grace Emerald', bg1: '#064E3B', bg2: '#059669', accent: '#A7F3D0' },
];

export default function PuzzleCaptchaModal({
    isOpen,
    onClose,
    onSuccess,
}: PuzzleCaptchaModalProps) {
    const [sliderValue, setSliderValue] = useState(0);
    const [themeIndex, setThemeIndex] = useState(0);
    const [targetPos, setTargetPos] = useState({ x: 180, y: 50 });
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('Drag the slider to fit the puzzle piece');
    const dragStartTimeRef = useRef<number>(0);

    const bgCanvasRef = useRef<HTMLCanvasElement>(null);
    const pieceCanvasRef = useRef<HTMLCanvasElement>(null);

    // Generate random target position and theme
    const initPuzzle = useCallback(() => {
        setSliderValue(0);
        setStatus('idle');
        setStatusMessage('Drag the slider to fit the puzzle piece');

        const newTheme = Math.floor(Math.random() * THEMES.length);
        setThemeIndex(newTheme);

        // Target X between 90 and 260, Target Y between 20 and 95
        const newTargetX = Math.floor(Math.random() * (CANVAS_WIDTH - PIECE_SIZE - 90)) + 90;
        const newTargetY = Math.floor(Math.random() * (CANVAS_HEIGHT - PIECE_SIZE - 30)) + 20;

        setTargetPos({ x: newTargetX, y: newTargetY });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            initPuzzle();
        }, 0);
        return () => clearTimeout(timer);
    }, [isOpen, initPuzzle]);

    // Draw background image and puzzle cutout
    useEffect(() => {
        if (!isOpen) return;
        const bgCanvas = bgCanvasRef.current;
        const pieceCanvas = pieceCanvasRef.current;
        if (!bgCanvas || !pieceCanvas) return;

        const bgCtx = bgCanvas.getContext('2d');
        const pieceCtx = pieceCanvas.getContext('2d');
        if (!bgCtx || !pieceCtx) return;

        const theme = THEMES[themeIndex] || THEMES[0];

        // 1. Draw Artistic Church / Stained Glass Motif Background
        const grad = bgCtx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        grad.addColorStop(0, theme.bg1);
        grad.addColorStop(0.5, theme.bg2);
        grad.addColorStop(1, theme.accent);
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Cathedral Gothic Arch Pattern
        bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        bgCtx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            bgCtx.beginPath();
            bgCtx.arc(35 + i * 65, 120, 28, Math.PI, 0);
            bgCtx.stroke();
        }

        // Stained Glass Rosette Pattern
        bgCtx.beginPath();
        bgCtx.arc(CANVAS_WIDTH / 2, 70, 36, 0, Math.PI * 2);
        bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        bgCtx.lineWidth = 3;
        bgCtx.stroke();

        // Sacred Cross Motif
        bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        bgCtx.lineWidth = 4;
        bgCtx.beginPath();
        bgCtx.moveTo(CANVAS_WIDTH / 2, 45);
        bgCtx.lineTo(CANVAS_WIDTH / 2, 95);
        bgCtx.moveTo(CANVAS_WIDTH / 2 - 16, 60);
        bgCtx.lineTo(CANVAS_WIDTH / 2 + 16, 60);
        bgCtx.stroke();

        // Radiating light rays
        bgCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
            bgCtx.beginPath();
            bgCtx.moveTo(CANVAS_WIDTH / 2, 70);
            bgCtx.arc(CANVAS_WIDTH / 2, 70, 100, a, a + 0.2);
            bgCtx.closePath();
            bgCtx.fill();
        }

        // 2. Extract Puzzle Piece Data at target position
        pieceCanvas.width = PIECE_SIZE;
        pieceCanvas.height = PIECE_SIZE;
        pieceCtx.clearRect(0, 0, PIECE_SIZE, PIECE_SIZE);

        const imgData = bgCtx.getImageData(targetPos.x, targetPos.y, PIECE_SIZE, PIECE_SIZE);
        pieceCtx.putImageData(imgData, 0, 0);

        // Add puzzle piece border and bevel
        pieceCtx.strokeStyle = '#FFFFFF';
        pieceCtx.lineWidth = 3;
        pieceCtx.strokeRect(1, 1, PIECE_SIZE - 2, PIECE_SIZE - 2);

        // 3. Render Cutout Slot on Main Canvas
        bgCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        bgCtx.fillRect(targetPos.x, targetPos.y, PIECE_SIZE, PIECE_SIZE);

        bgCtx.strokeStyle = '#FFFFFF';
        bgCtx.lineWidth = 2;
        bgCtx.setLineDash([4, 4]);
        bgCtx.strokeRect(targetPos.x, targetPos.y, PIECE_SIZE, PIECE_SIZE);
        bgCtx.setLineDash([]);
    }, [isOpen, themeIndex, targetPos]);

    // Handle Drag Movement
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (status === 'success') return;
        const val = Number(e.target.value);
        setSliderValue(val);
    };

    const handleDragStart = () => {
        if (status === 'success') return;
        dragStartTimeRef.current = Date.now();
        setStatus('idle');
    };

    const handleDragEnd = () => {
        if (status === 'success') return;

        const maxSlider = CANVAS_WIDTH - PIECE_SIZE;
        // Piece X position is based on slider value mapped to width
        const pieceX = (sliderValue / 100) * maxSlider;
        const diff = Math.abs(pieceX - targetPos.x);

        const dragDuration = Date.now() - dragStartTimeRef.current;

        // Anti-bot heuristic: human dragging requires at least 150ms and difference within tolerance
        if (diff <= TOLERANCE_PX && dragDuration >= 150) {
            setStatus('success');
            setStatusMessage('Verification Successful!');
            const token = `puzzle-verified-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

            setTimeout(() => {
                onSuccess(token);
                onClose();
            }, 600);
        } else {
            setStatus('error');
            setStatusMessage('Puzzle piece misaligned. Please try again.');
            setTimeout(() => {
                setSliderValue(0);
                setStatus('idle');
                setStatusMessage('Drag the slider to fit the puzzle piece');
            }, 800);
        }
    };

    if (!isOpen) return null;

    const maxSlider = CANVAS_WIDTH - PIECE_SIZE;
    const currentPieceX = (sliderValue / 100) * maxSlider;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-[360px] rounded-2xl border border-border bg-white p-5 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Security Verification</h3>
                            <p className="text-[11px] text-muted">Complete the puzzle to continue</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-muted hover:bg-secondary-50 hover:text-foreground transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Canvas Container */}
                <div className="relative mt-4 mx-auto overflow-hidden rounded-xl border border-border bg-slate-900 shadow-inner" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
                    <canvas
                        ref={bgCanvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        className="block w-full h-full"
                    />

                    {/* Sliding Puzzle Piece */}
                    <div
                        className="absolute pointer-events-none transition-transform"
                        style={{
                            left: 0,
                            top: `${targetPos.y}px`,
                            transform: `translateX(${currentPieceX}px)`,
                            width: PIECE_SIZE,
                            height: PIECE_SIZE,
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
                        }}
                    >
                        <canvas
                            ref={pieceCanvasRef}
                            width={PIECE_SIZE}
                            height={PIECE_SIZE}
                            className={`rounded-sm transition-all duration-150 ${status === 'success' ? 'ring-2 ring-emerald-400' : 'ring-1 ring-white/90'}`}
                        />
                    </div>

                    {/* Status Feedback Overlay */}
                    {status === 'success' && (
                        <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-in zoom-in-95 duration-200">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-1" />
                            <p className="text-xs font-semibold">Verification Complete!</p>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="absolute inset-0 bg-red-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white animate-in zoom-in-95 duration-200">
                            <AlertCircle className="w-8 h-8 text-red-400 mb-1 animate-bounce" />
                            <p className="text-xs font-medium">Alignment failed. Resetting...</p>
                        </div>
                    )}
                </div>

                {/* Status Message */}
                <div className="mt-3 text-center">
                    <p className={`text-xs font-medium ${
                        status === 'success' ? 'text-emerald-600' : status === 'error' ? 'text-destructive' : 'text-muted'
                    }`}>
                        {statusMessage}
                    </p>
                </div>

                {/* Interactive Slider */}
                <div className="mt-3 space-y-2">
                    <div className="relative flex items-center">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={sliderValue}
                            onChange={handleSliderChange}
                            onMouseDown={handleDragStart}
                            onMouseUp={handleDragEnd}
                            onTouchStart={handleDragStart}
                            onTouchEnd={handleDragEnd}
                            disabled={status === 'success'}
                            className="w-full h-10 appearance-none bg-secondary-100 rounded-full cursor-pointer accent-primary focus:outline-none transition-all px-1"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                    <button
                        type="button"
                        onClick={initPuzzle}
                        disabled={status === 'success'}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh puzzle</span>
                    </button>
                    <span className="text-[11px] text-muted">SacraLink Shield v1</span>
                </div>
            </div>
        </div>
    );
}
