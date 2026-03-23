'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import ReactCrop, {
  type PercentCrop,
  type PixelCrop,
  convertToPixelCrop,
} from 'react-image-crop';

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedBlob: Blob, croppedDataUrl: string) => void;
  onCancel: () => void;
}

const DEFAULT_INSET_PERCENT = 6;

function buildInitialCrop(): PercentCrop {
  return {
    unit: '%',
    x: DEFAULT_INSET_PERCENT,
    y: DEFAULT_INSET_PERCENT,
    width: 100 - DEFAULT_INSET_PERCENT * 2,
    height: 100 - DEFAULT_INSET_PERCENT * 2,
  };
}

async function createCroppedImage(image: HTMLImageElement, crop: PixelCrop) {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sourceX = Math.round(crop.x * scaleX);
  const sourceY = Math.round(crop.y * scaleY);
  const sourceWidth = Math.max(1, Math.round(crop.width * scaleX));
  const sourceHeight = Math.max(1, Math.round(crop.height * scaleY));

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create crop canvas');
  }

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });

  if (!blob) {
    throw new Error('Failed to generate cropped image');
  }

  return {
    blob,
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
  };
}

export default function ImageCropper({ imageUrl, onCropComplete, onCancel }: ImageCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<PercentCrop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    imageRef.current = null;
    setCrop(undefined);
    setCompletedCrop(undefined);
    setLoadError(null);
    setIsSaving(false);
  }, [imageUrl]);

  const handleImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const image = e.currentTarget;
    const nextCrop = buildInitialCrop();

    imageRef.current = image;
    setLoadError(null);
    setCrop(nextCrop);
    setCompletedCrop(convertToPixelCrop(nextCrop, image.width, image.height));
  };

  const handleCrop = async () => {
    if (!imageRef.current || !completedCrop || completedCrop.width < 1 || completedCrop.height < 1) {
      return;
    }

    setIsSaving(true);

    try {
      const { blob, dataUrl } = await createCroppedImage(imageRef.current, completedCrop);
      onCropComplete(blob, dataUrl);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Crop Image</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Drag the selection to move it. Use the corner handles to resize.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="flex min-h-[45vh] items-center justify-center rounded-xl bg-gray-100 p-2 dark:bg-gray-900/60 sm:min-h-[55vh] sm:p-4">
            {loadError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                The selected image could not be loaded for cropping.
              </p>
            ) : (
              <ReactCrop
                crop={crop}
                keepSelection
                minHeight={80}
                minWidth={80}
                ruleOfThirds
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                style={{ maxHeight: '72vh', maxWidth: '100%' }}
              >
                {/* ReactCrop expects a real img element so it can measure the rendered media correctly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Crop preview"
                  className="max-h-[72vh] max-w-full select-none object-contain"
                  draggable={false}
                  onError={() => setLoadError('failed')}
                  onLoad={handleImageLoad}
                  src={imageUrl}
                />
              </ReactCrop>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 p-4 dark:border-gray-700 sm:flex-row sm:justify-end">
          <button
            className="rounded-lg bg-gray-200 px-6 py-3 text-base text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-blue-600 px-6 py-3 text-base text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            disabled={!completedCrop || isSaving || !!loadError}
            onClick={handleCrop}
            type="button"
          >
            {isSaving ? 'Cropping...' : 'Crop & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
