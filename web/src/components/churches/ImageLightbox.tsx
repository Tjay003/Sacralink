import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const nextImage = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') nextImage();
        if (e.key === 'ArrowLeft') prevImage();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
            onClick={onClose}
            onKeyDown={handleKey}
            tabIndex={0}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Navigation Buttons */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            prevImage();
                        }}
                        className="absolute left-4 text-white p-3 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            nextImage();
                        }}
                        className="absolute right-4 text-white p-3 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </>
            )}

            {/* Image */}
            <div
                className="max-w-7xl max-h-[90vh] px-4"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={images[currentIndex]}
                    alt={`Gallery image ${currentIndex + 1}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
            </div>

            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-4 py-2 rounded-full">
                {currentIndex + 1} / {images.length}
            </div>
        </div>
    );
}
