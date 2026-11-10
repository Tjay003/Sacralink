/**
 * imageCompression.ts
 *
 * Client-side image compression utility optimized for QR codes and donation graphics.
 * Constrains dimensions, fills a clean white background (preventing transparent QR voids),
 * and compresses to WebP (with graceful JPEG fallback), drastically reducing upload payloads.
 */

/**
 * Compresses an uploaded QR code or payment graphic on the client side before storage upload.
 *
 * @param file - The input File object selected by the user.
 * @param maxDimension - Max width or height constraint (default: 800px).
 * @param quality - Compression quality between 0.0 and 1.0 (default: 0.82).
 * @returns A promise resolving to a compressed File object, or the original file if compression fails or isn't supported.
 */
export async function compressQrImage(
    file: File,
    maxDimension = 800,
    quality = 0.82
): Promise<File> {
    // Return original file in non-browser or test environments
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return file;
    }

    // Skip non-image or invalid files
    if (!file || !file.type.startsWith('image/')) {
        return file;
    }

    // SVG files should be kept as vectors without rasterizing
    if (file.type === 'image/svg+xml') {
        return file;
    }

    try {
        let source: CanvasImageSource | null = null;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let closeBitmap = false;

        // 1. Try createImageBitmap for fast, off-main-thread decoding
        if (typeof createImageBitmap === 'function') {
            try {
                const bitmap = await createImageBitmap(file);
                source = bitmap;
                sourceWidth = bitmap.width;
                sourceHeight = bitmap.height;
                closeBitmap = true;
            } catch {
                // Ignore and fall back to HTMLImageElement
                source = null;
            }
        }

        // 2. Fall back to standard Image element decoding if createImageBitmap is unavailable or failed
        if (!source || !sourceWidth || !sourceHeight) {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                const objectUrl = URL.createObjectURL(file);
                image.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(image);
                };
                image.onerror = (err) => {
                    URL.revokeObjectURL(objectUrl);
                    reject(err);
                };
                image.src = objectUrl;
            });
            source = img;
            sourceWidth = img.naturalWidth || img.width;
            sourceHeight = img.naturalHeight || img.height;
        }

        if (!sourceWidth || !sourceHeight) {
            return file;
        }

        // 3. Calculate target aspect-ratio preserving dimensions
        let targetWidth = sourceWidth;
        let targetHeight = sourceHeight;

        if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
            if (sourceWidth >= sourceHeight) {
                targetWidth = maxDimension;
                targetHeight = Math.round((sourceHeight * maxDimension) / sourceWidth);
            } else {
                targetHeight = maxDimension;
                targetWidth = Math.round((sourceWidth * maxDimension) / sourceHeight);
            }
        }

        targetWidth = Math.max(1, targetWidth);
        targetHeight = Math.max(1, targetHeight);

        // 4. Render to canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            if (closeBitmap && source && 'close' in source && typeof (source as ImageBitmap).close === 'function') {
                (source as ImageBitmap).close();
            }
            return file;
        }

        // Fill background with solid white (ensures high contrast scannability for QR codes with transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

        if (closeBitmap && source && 'close' in source && typeof (source as ImageBitmap).close === 'function') {
            (source as ImageBitmap).close();
        }

        // 5. Convert to Blob (WebP first, falling back to JPEG)
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
                (webpBlob) => {
                    if (webpBlob) {
                        resolve(webpBlob);
                    } else {
                        // Fallback to JPEG if WebP encoding is unsupported
                        canvas.toBlob((jpegBlob) => resolve(jpegBlob), 'image/jpeg', quality);
                    }
                },
                'image/webp',
                quality
            );
        });

        if (!blob) {
            return file;
        }

        // 6. Construct clean File instance
        const rawBaseName = file.name.replace(/\.[^/.]+$/, '');
        const cleanBaseName = rawBaseName.trim() || 'qr_code';
        const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
        const finalFilename = `${cleanBaseName}.${extension}`;

        return new File([blob], finalFilename, {
            type: blob.type,
            lastModified: Date.now(),
        });
    } catch (err) {
        console.warn('QR image compression failed, falling back to original file:', err);
        return file;
    }
}
