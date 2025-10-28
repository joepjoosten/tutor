'use client';

import { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  imageUrl: string;
  onCropComplete: (croppedBlob: Blob, croppedDataUrl: string) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCropper({ imageUrl, onCropComplete, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      // Initialize crop area to full image
      const canvas = canvasRef.current;
      if (canvas) {
        const containerWidth = canvas.parentElement?.clientWidth || 800;
        const containerHeight = 600;
        const imgAspect = img.width / img.height;
        const containerAspect = containerWidth / containerHeight;

        let displayWidth, displayHeight;
        if (imgAspect > containerAspect) {
          displayWidth = containerWidth;
          displayHeight = containerWidth / imgAspect;
        } else {
          displayHeight = containerHeight;
          displayWidth = containerHeight * imgAspect;
        }

        setScale(displayWidth / img.width);
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        // Set initial crop to full image
        setCropArea({
          x: 0,
          y: 0,
          width: displayWidth,
          height: displayHeight,
        });
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

    // Redraw image in crop area
    const sourceX = cropArea.x / scale;
    const sourceY = cropArea.y / scale;
    const sourceWidth = cropArea.width / scale;
    const sourceHeight = cropArea.height / scale;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    );

    // Draw crop rectangle
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 3;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

    // Draw corner handles (larger for touch)
    const handleSize = 20;
    ctx.fillStyle = '#3B82F6';
    // Top-left
    ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize);
    // Top-right
    ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y - handleSize / 2, handleSize, handleSize);
    // Bottom-left
    ctx.fillRect(cropArea.x - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize);
    // Bottom-right
    ctx.fillRect(cropArea.x + cropArea.width - handleSize / 2, cropArea.y + cropArea.height - handleSize / 2, handleSize, handleSize);
  }, [image, cropArea, scale]);

  const getPointerPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getPointerPosition(e);
    if (!pos) return;

    const { x, y } = pos;

    // Check if clicking/touching on a corner handle (larger hit area for touch)
    const handleSize = 30; // Larger hit area for touch
    const corners = [
      { x: cropArea.x, y: cropArea.y }, // top-left
      { x: cropArea.x + cropArea.width, y: cropArea.y }, // top-right
      { x: cropArea.x, y: cropArea.y + cropArea.height }, // bottom-left
      { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height }, // bottom-right
    ];

    for (const corner of corners) {
      if (Math.abs(x - corner.x) < handleSize && Math.abs(y - corner.y) < handleSize) {
        setIsResizing(true);
        setDragStart({ x, y });
        return;
      }
    }

    // Check if clicking/touching inside crop area
    if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.width &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.height
    ) {
      setIsDragging(true);
      setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    const { x, y } = pos;

    if (isDragging) {
      const newX = Math.max(0, Math.min(x - dragStart.x, canvas.width - cropArea.width));
      const newY = Math.max(0, Math.min(y - dragStart.y, canvas.height - cropArea.height));
      setCropArea({ ...cropArea, x: newX, y: newY });
    } else if (isResizing) {
      const newWidth = Math.max(50, Math.min(x - cropArea.x, canvas.width - cropArea.x));
      const newHeight = Math.max(50, Math.min(y - cropArea.y, canvas.height - cropArea.y));
      setCropArea({ ...cropArea, width: newWidth, height: newHeight });
    }
  };

  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleCrop = async () => {
    if (!image || !canvasRef.current) return;

    const cropCanvas = document.createElement('canvas');
    const sourceX = cropArea.x / scale;
    const sourceY = cropArea.y / scale;
    const sourceWidth = cropArea.width / scale;
    const sourceHeight = cropArea.height / scale;

    cropCanvas.width = sourceWidth;
    cropCanvas.height = sourceHeight;

    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

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

    cropCanvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
          onCropComplete(blob, croppedDataUrl);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Crop Image</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Drag to move crop area, drag corners to resize
          </p>
        </div>

        <div className="p-4 flex justify-center overflow-auto" style={{ touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            onTouchCancel={handleEnd}
            className="cursor-move border border-gray-300 dark:border-gray-600 touch-none"
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-base"
          >
            Crop & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
