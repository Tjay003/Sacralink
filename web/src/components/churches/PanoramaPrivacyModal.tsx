import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Paintbrush,
  RotateCcw,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import {
  detectFacesAndPeopleInPanorama,
  renderBlurredPanorama,
  canvasToFile,
  type BlurRegion,
  type ManualBrushPoint,
} from '../../utils/panoramaBlur';

export interface PanoramaPrivacyModalProps {
  isOpen: boolean;
  file: File | null;
  churchName?: string;
  onClose: () => void;
  onConfirm: (processedFile: File) => Promise<void> | void;
}

export default function PanoramaPrivacyModal({
  isOpen,
  file,
  churchName,
  onClose,
  onConfirm,
}: PanoramaPrivacyModalProps) {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [scanning, setScanning] = useState(true);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('Initializing privacy scanner...');
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [manualStrokes, setManualStrokes] = useState<ManualBrushPoint[]>([]);
  const [brushMode, setBrushMode] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(36);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPaintingRef = useRef(false);

  // 1. Load source image when file changes
  useEffect(() => {
    if (!isOpen || !file) {
      setSourceImage(null);
      setRegions([]);
      setManualStrokes([]);
      setScanning(false);
      setError(null);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      setSourceImage(img);
      setScanning(true);
      setProgressPercent(10);
      setProgressText('Analyzing sanctuary photo sectors...');

      void detectFacesAndPeopleInPanorama(img, (percent, text) => {
        setProgressPercent(percent);
        setProgressText(text);
      })
        .then((detected) => {
          setRegions(detected);
          setScanning(false);
        })
        .catch((err) => {
          console.error('Detection error:', err);
          setScanning(false);
          setError('AI scan encountered a warning. You can still use the Manual Blur Brush.');
        });
    };

    img.onerror = () => {
      setError('Could not load the selected panorama image.');
      setScanning(false);
    };

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file]);

  // 2. Redraw canvas whenever regions, strokes, showOriginal, or sourceImage changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    if (canvas.width !== sourceImage.naturalWidth || canvas.height !== sourceImage.naturalHeight) {
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;
    }

    if (showOriginal) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      }
    } else {
      renderBlurredPanorama(canvas, sourceImage, regions, manualStrokes, 26);
    }
  }, [sourceImage, regions, manualStrokes, showOriginal]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 3. Toggle single region on/off
  const toggleRegion = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  // 4. Toggle all regions
  const toggleAllRegions = (enable: boolean) => {
    setRegions((prev) => prev.map((r) => ({ ...r, enabled: enable })));
  };

  // 5. Manual brush painting handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!brushMode || !sourceImage || showOriginal) return;
    isPaintingRef.current = true;
    addBrushStrokeAtEvent(e);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current || !brushMode || !sourceImage || showOriginal) return;
    addBrushStrokeAtEvent(e);
  };

  const handleCanvasMouseUp = () => {
    isPaintingRef.current = false;
  };

  const addBrushStrokeAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const normalizedX = clickX / canvas.width;
    const normalizedY = clickY / canvas.height;
    const scaledRadius = brushSize * ((scaleX + scaleY) / 2);

    setManualStrokes((prev) => [
      ...prev,
      { x: normalizedX, y: normalizedY, radius: scaledRadius },
    ]);
  };

  const handleClearManualStrokes = () => {
    setManualStrokes([]);
  };

  // 6. Confirm and Export
  const handleSaveAndConfirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;

    setSaving(true);
    setError(null);

    try {
      // Ensure canvas has the latest blur render applied
      redrawCanvas();

      const sanitizedName = file.name.replace(/\.[^/.]+$/, '') + '_anonymized.jpg';
      const anonymizedFile = await canvasToFile(canvas, sanitizedName, 0.93);

      await onConfirm(anonymizedFile);
      onClose();
    } catch (err: unknown) {
      console.error('Error saving blurred panorama:', err);
      setError(err instanceof Error ? err.message : 'Failed to process blurred panorama.');
    } finally {
      setSaving(false);
    }
  };

  const activeRegionsCount = regions.filter((r) => r.enabled).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Sanctuary Privacy Protection
            </h2>
            <p className="text-xs text-muted">
              {churchName ? `${churchName} • ` : ''}360° virtual tours blur parishioners and visitors to safeguard personal privacy inside the church
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Scanning Banner */}
        {scanning ? (
          <div className="p-5 border border-primary/20 bg-primary/5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in">
            <div className="relative">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{progressText}</p>
              <p className="text-xs text-muted mt-0.5">
                Scanning equirectangular 360° image for faces and parishioners
              </p>
            </div>
            <div className="w-full max-w-xs bg-secondary-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          /* Controls Toolbar */
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-secondary-50/70 border border-border rounded-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {regions.length > 0
                  ? `${activeRegionsCount} of ${regions.length} detected zones blurred`
                  : 'No faces detected'}
              </span>

              {regions.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleAllRegions(activeRegionsCount === 0)}
                  className="text-xs text-primary hover:underline font-medium px-1 cursor-pointer"
                >
                  {activeRegionsCount === 0 ? 'Enable All Zones' : 'Disable All Zones'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Brush Tool Toggle */}
              <button
                type="button"
                onClick={() => setBrushMode(!brushMode)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                  brushMode
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-white text-foreground border-border hover:bg-secondary-50'
                }`}
                title="Click and drag on the photo to blur any missed person"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>{brushMode ? 'Brush Active (Draw on Image)' : 'Manual Blur Brush'}</span>
              </button>

              {/* Brush Size Selector */}
              {brushMode && (
                <div className="flex items-center gap-1.5 bg-white border border-border px-2.5 py-1 rounded-xl text-xs">
                  <span className="text-muted font-medium text-[11px]">Size:</span>
                  <button
                    type="button"
                    onClick={() => setBrushSize(24)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${brushSize === 24 ? 'bg-primary text-white' : 'text-foreground'}`}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(40)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${brushSize === 40 ? 'bg-primary text-white' : 'text-foreground'}`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrushSize(65)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${brushSize === 65 ? 'bg-primary text-white' : 'text-foreground'}`}
                  >
                    L
                  </button>
                </div>
              )}

              {/* Undo Brush Strokes */}
              {manualStrokes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearManualStrokes}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-border bg-white text-muted hover:text-foreground hover:bg-secondary-50 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear all manual brush strokes"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Brush ({manualStrokes.length})</span>
                </button>
              )}

              {/* Hold to Compare Toggle */}
              <button
                type="button"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground flex items-center gap-1.5 transition-colors cursor-pointer select-none"
                title="Hold down to preview unblurred original"
              >
                {showOriginal ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{showOriginal ? 'Showing Original' : 'Hold to View Original'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 360 Panorama Canvas Container */}
        <div
          ref={containerRef}
          className="relative w-full h-[320px] sm:h-[420px] bg-slate-950 rounded-2xl overflow-auto border border-border shadow-inner flex items-center justify-center"
          style={{ cursor: brushMode ? 'crosshair' : 'default' }}
        >
          {sourceImage ? (
            <div className="relative inline-block max-w-full">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className="max-h-[300px] sm:max-h-[400px] w-auto h-auto object-contain block mx-auto select-none"
              />

              {/* Interactive Zone Overlays (only shown when not holding original and not scanning) */}
              {!showOriginal && !scanning && canvasRef.current && (
                <div className="absolute inset-0 pointer-events-none">
                  {regions.map((reg) => {
                    return (
                      <div
                        key={reg.id}
                        onClick={(e) => toggleRegion(reg.id, e)}
                        style={{
                          left: `${reg.x * 100}%`,
                          top: `${reg.y * 100}%`,
                          width: `${reg.width * 100}%`,
                          height: `${reg.height * 100}%`,
                        }}
                        className={`absolute border-2 rounded-lg transition-all pointer-events-auto cursor-pointer group flex items-start justify-end p-0.5 ${
                          reg.enabled
                            ? 'border-emerald-500/80 bg-emerald-500/10 hover:border-emerald-400'
                            : 'border-red-400/60 bg-red-500/10 hover:border-red-500'
                        }`}
                        title={
                          reg.enabled
                            ? 'Privacy blur active. Click to UNBLUR (e.g. if this is a saint statue or artwork).'
                            : 'Unblurred. Click to BLUR this region.'
                        }
                      >
                        <span
                          className={`text-[9px] font-bold px-1 rounded-sm shadow-xs ${
                            reg.enabled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {reg.enabled ? 'Blurred' : 'Ignored'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 text-white/50 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Loading panorama image...
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-secondary-500" />
            <span>
              Tip: Click any green box to toggle unblur (useful for saint statues or paintings). Use the Manual Blur Brush to cover extra areas.
            </span>
          </div>
          {file && (
            <span className="font-mono truncate max-w-[200px]">
              {file.name}
            </span>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndConfirm}
            disabled={saving || scanning || !sourceImage}
            className="btn-primary px-5 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Privacy Protection & Uploading...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Apply Privacy Blur & Save Panorama</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
