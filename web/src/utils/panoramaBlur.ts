import { FilesetResolver, FaceDetector, ObjectDetector } from '@mediapipe/tasks-vision';

export interface BlurRegion {
  id: string;
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  width: number; // 0 to 1 normalized
  height: number; // 0 to 1 normalized
  confidence?: number;
  label: 'face' | 'person' | 'manual';
  enabled: boolean;
}

export interface ManualBrushPoint {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  radius: number; // in pixels relative to display canvas or normalized
}

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const PERSON_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

let faceDetectorInstance: FaceDetector | null = null;
let personDetectorInstance: ObjectDetector | null = null;
let isInitializing = false;

/**
 * Initializes or reuses the MediaPipe Vision detectors.
 * Fails gracefully so manual blurring remains 100% operational offline.
 */
export async function getVisionDetectors(): Promise<{
  faceDetector: FaceDetector | null;
  personDetector: ObjectDetector | null;
}> {
  if (faceDetectorInstance) {
    return { faceDetector: faceDetectorInstance, personDetector: personDetectorInstance };
  }

  if (isInitializing) {
    // Wait up to 5s if another call is currently initializing
    let attempts = 0;
    while (isInitializing && attempts < 25) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
      if (faceDetectorInstance) {
        return { faceDetector: faceDetectorInstance, personDetector: personDetectorInstance };
      }
    }
  }

  isInitializing = true;
  try {
    const wasmFileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

    try {
      faceDetectorInstance = await FaceDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
        },
        minDetectionConfidence: 0.35,
        minSuppressionThreshold: 0.3,
      });
    } catch (faceErr) {
      console.warn('MediaPipe FaceDetector failed to initialize:', faceErr);
    }

    try {
      personDetectorInstance = await ObjectDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: PERSON_MODEL_URL,
        },
        categoryAllowlist: ['person'],
        scoreThreshold: 0.4,
      });
    } catch (personErr) {
      console.warn('MediaPipe ObjectDetector failed to initialize:', personErr);
    }

    return { faceDetector: faceDetectorInstance, personDetector: personDetectorInstance };
  } catch (err) {
    console.warn('Could not initialize MediaPipe WASM runtime:', err);
    return { faceDetector: null, personDetector: null };
  } finally {
    isInitializing = false;
  }
}

/**
 * Calculates Intersection over Union (IoU) of two normalized bounding boxes.
 */
function calculateIoU(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Non-Maximum Suppression (NMS) to remove duplicate detections.
 */
function applyNms(boxes: BlurRegion[], iouThreshold = 0.4): BlurRegion[] {
  const sorted = [...boxes].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const selected: BlurRegion[] = [];

  for (const box of sorted) {
    let shouldAdd = true;
    for (const chosen of selected) {
      if (calculateIoU(box, chosen) > iouThreshold) {
        shouldAdd = false;
        break;
      }
    }
    if (shouldAdd) {
      selected.push(box);
    }
  }

  return selected;
}

/**
 * Scans an image/panorama using tiled crops (4x2 grid with 15% overlap)
 * to catch small faces and people across a high-resolution 360 equirectangular image.
 */
export async function detectFacesAndPeopleInPanorama(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  onProgress?: (percent: number, stepText: string) => void
): Promise<BlurRegion[]> {
  onProgress?.(5, 'Loading AI privacy models...');
  const { faceDetector, personDetector } = await getVisionDetectors();

  if (!faceDetector && !personDetector) {
    onProgress?.(100, 'AI models unavailable; manual blur enabled.');
    return [];
  }

  const rawWidth = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
  const rawHeight = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

  const detectedBoxes: BlurRegion[] = [];

  // Tile slicing settings: 4 cols x 2 rows with 15% overlap
  const cols = 4;
  const rows = 2;
  const overlap = 0.15;

  const tileW = rawWidth / cols;
  const tileH = rawHeight / rows;

  const tileCanvas = document.createElement('canvas');
  const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });

  const totalTiles = cols * rows + 1; // + 1 for global scaled pass
  let completed = 0;

  // 1. Full image scaled-down pass (catches large people/foreground)
  onProgress?.(15, 'Scanning panorama global view...');
  try {
    const fullCanvas = document.createElement('canvas');
    const maxFullDim = 1280;
    const scale = Math.min(1, maxFullDim / Math.max(rawWidth, rawHeight));
    fullCanvas.width = Math.round(rawWidth * scale);
    fullCanvas.height = Math.round(rawHeight * scale);
    const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
    if (fullCtx) {
      fullCtx.drawImage(sourceImage, 0, 0, fullCanvas.width, fullCanvas.height);

      if (faceDetector) {
        const results = faceDetector.detect(fullCanvas);
        for (const det of results.detections) {
          const bb = det.boundingBox;
          if (bb) {
            detectedBoxes.push({
              id: `face-global-${Math.random().toString(36).substring(2, 9)}`,
              x: (bb.originX / fullCanvas.width),
              y: (bb.originY / fullCanvas.height),
              width: (bb.width / fullCanvas.width),
              height: (bb.height / fullCanvas.height),
              confidence: det.categories[0]?.score || 0.8,
              label: 'face',
              enabled: true,
            });
          }
        }
      }

      if (personDetector) {
        const pResults = personDetector.detect(fullCanvas);
        for (const det of pResults.detections) {
          const bb = det.boundingBox;
          if (bb) {
            // For person detections, focus blur primarily on head/upper-body area (top 35% of person box)
            detectedBoxes.push({
              id: `person-global-${Math.random().toString(36).substring(2, 9)}`,
              x: (bb.originX / fullCanvas.width),
              y: (bb.originY / fullCanvas.height),
              width: (bb.width / fullCanvas.width),
              height: Math.min(bb.height / fullCanvas.height, (bb.height / fullCanvas.height) * 0.45),
              confidence: det.categories[0]?.score || 0.7,
              label: 'person',
              enabled: true,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error during global panorama pass:', err);
  }

  completed++;

  // 2. Tiled scanning for church pews & distant parishioners
  if (tileCtx) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const stepProgress = Math.round(20 + (completed / totalTiles) * 75);
        onProgress?.(stepProgress, `Scanning sanctuary sector ${completed} of ${totalTiles}...`);

        // Compute crop bounds with overlap
        const startX = Math.max(0, c * tileW - tileW * overlap);
        const endX = Math.min(rawWidth, (c + 1) * tileW + tileW * overlap);
        const startY = Math.max(0, r * tileH - tileH * overlap);
        const endY = Math.min(rawHeight, (r + 1) * tileH + tileH * overlap);

        const cropW = endX - startX;
        const cropH = endY - startY;

        tileCanvas.width = cropW;
        tileCanvas.height = cropH;

        tileCtx.clearRect(0, 0, cropW, cropH);
        tileCtx.drawImage(sourceImage, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

        try {
          if (faceDetector) {
            const faceResult = faceDetector.detect(tileCanvas);
            for (const det of faceResult.detections) {
              const bb = det.boundingBox;
              if (bb) {
                const absX = startX + bb.originX;
                const absY = startY + bb.originY;
                detectedBoxes.push({
                  id: `face-tile-${r}-${c}-${Math.random().toString(36).substring(2, 7)}`,
                  x: absX / rawWidth,
                  y: absY / rawHeight,
                  width: bb.width / rawWidth,
                  height: bb.height / rawHeight,
                  confidence: det.categories[0]?.score || 0.75,
                  label: 'face',
                  enabled: true,
                });
              }
            }
          }

          if (personDetector) {
            const pResult = personDetector.detect(tileCanvas);
            for (const det of pResult.detections) {
              const bb = det.boundingBox;
              if (bb) {
                const absX = startX + bb.originX;
                const absY = startY + bb.originY;
                detectedBoxes.push({
                  id: `person-tile-${r}-${c}-${Math.random().toString(36).substring(2, 7)}`,
                  x: absX / rawWidth,
                  y: absY / rawHeight,
                  width: bb.width / rawWidth,
                  height: Math.min(bb.height / rawHeight, (bb.height / rawHeight) * 0.45),
                  confidence: det.categories[0]?.score || 0.65,
                  label: 'person',
                  enabled: true,
                });
              }
            }
          }
        } catch (tileErr) {
          console.warn(`Tile (${r},${c}) detection warning:`, tileErr);
        }

        completed++;
      }
    }
  }

  onProgress?.(95, 'Consolidating and merging privacy regions...');
  const merged = applyNms(detectedBoxes, 0.35);

  // Add extra padding (15% horizontal, 20% vertical) around face bounding boxes for natural hair/chin blur
  const padded = merged.map((b) => {
    const padX = b.width * 0.15;
    const padY = b.height * 0.2;
    const newX = Math.max(0, b.x - padX / 2);
    const newY = Math.max(0, b.y - padY / 2);
    const newW = Math.min(1 - newX, b.width + padX);
    const newH = Math.min(1 - newY, b.height + padY);

    return {
      ...b,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    };
  });

  onProgress?.(100, `Done. Found ${padded.length} privacy protection zones.`);
  return padded;
}

/**
 * Applies feathered Gaussian blur to specified regions and manual brush strokes on an HTML canvas.
 */
export function renderBlurredPanorama(
  targetCanvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  regions: BlurRegion[],
  manualStrokes: ManualBrushPoint[] = [],
  blurStrength = 22
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  // 1. Draw base clear image
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sourceImage, 0, 0, width, height);

  // 2. Render each enabled detected region with feathered elliptical blur
  const activeRegions = regions.filter((r) => r.enabled);
  if (activeRegions.length === 0 && manualStrokes.length === 0) {
    return;
  }

  // Create blurred copy of source image
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = width;
  blurCanvas.height = height;
  const blurCtx = blurCanvas.getContext('2d');
  if (!blurCtx) return;

  blurCtx.filter = `blur(${blurStrength}px)`;
  blurCtx.drawImage(sourceImage, 0, 0, width, height);

  // Draw blurred pixels over active regions using an elliptical mask
  for (const reg of activeRegions) {
    const pixelX = reg.x * width;
    const pixelY = reg.y * height;
    const pixelW = reg.width * width;
    const pixelH = reg.height * height;

    const centerX = pixelX + pixelW / 2;
    const centerY = pixelY + pixelH / 2;
    const radiusX = Math.max(6, pixelW / 2);
    const radiusY = Math.max(6, pixelH / 2);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(blurCanvas, 0, 0, width, height);
    ctx.restore();
  }

  // 3. Render manual brush points
  for (const stroke of manualStrokes) {
    const px = stroke.x * width;
    const py = stroke.y * height;
    const rad = stroke.radius;

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(blurCanvas, 0, 0, width, height);
    ctx.restore();
  }
}

/**
 * Converts a canvas to a JPEG Blob/File ready for Supabase Storage upload.
 */
export function canvasToFile(
  canvas: HTMLCanvasElement,
  filename: string,
  quality = 0.92
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob from canvas'));
          return;
        }
        const file = new File([blob], filename, { type: 'image/jpeg' });
        resolve(file);
      },
      'image/jpeg',
      quality
    );
  });
}
