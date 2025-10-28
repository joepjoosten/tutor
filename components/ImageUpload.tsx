'use client';

import { useState } from 'react';
import ImageCropper from './ImageCropper';

interface UploadedImage {
  id: number;
  filepath: string;
  preview: string;
}

interface ImageUploadProps {
  onImagesChange: (images: UploadedImage[]) => void;
}

interface PendingImage {
  file: File;
  preview: string;
}

// Compress image to target size (default ~1MB)
async function compressImage(blob: Blob, maxSizeKB: number = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate new dimensions (max 1920px width/height)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to get under target size
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (compressedBlob) => {
              if (!compressedBlob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // If size is good or quality is too low, accept it
              if (compressedBlob.size <= maxSizeKB * 1024 || quality <= 0.1) {
                resolve(compressedBlob);
              } else {
                // Try again with lower quality
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

export default function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<PendingImage | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // Convert files to pending images for cropping
    const newPending: PendingImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newPending.push({ file, preview });
    }

    // Add to pending queue
    const allPending = [...pendingImages, ...newPending];
    setPendingImages(allPending);

    // Start cropping first image if not already cropping
    if (!cropImage && allPending.length > 0) {
      setCropImage(allPending[0]);
    }

    // Reset input
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob, croppedDataUrl: string) => {
    if (!cropImage) return;

    setUploading(true);
    setCropImage(null);

    try {
      // Compress the cropped image if needed
      let fileToUpload: Blob = croppedBlob;
      const originalSizeKB = croppedBlob.size / 1024;

      if (originalSizeKB > 1024) {
        try {
          const compressed = await compressImage(croppedBlob, 1024);
          const compressedSizeKB = compressed.size / 1024;
          console.log(
            `Compressed ${cropImage.file.name}: ${originalSizeKB.toFixed(0)}KB -> ${compressedSizeKB.toFixed(0)}KB`
          );
          fileToUpload = compressed;
        } catch (err) {
          console.error('Compression failed, using cropped image:', err);
        }
      }

      // Upload file
      const formData = new FormData();
      formData.append('file', fileToUpload, cropImage.file.name);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Add to uploaded images
      const newImages = [
        ...images,
        {
          id: data.image.id,
          filepath: data.image.filepath,
          preview: croppedDataUrl,
        },
      ];
      setImages(newImages);
      onImagesChange(newImages);

      // Remove from pending and show next
      const remaining = pendingImages.slice(1);
      setPendingImages(remaining);
      if (remaining.length > 0) {
        setCropImage(remaining[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    // Remove current image from pending
    const remaining = pendingImages.slice(1);
    setPendingImages(remaining);
    setCropImage(remaining.length > 0 ? remaining[0] : null);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
  };

  return (
    <div className="w-full">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <svg
            className="w-16 h-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium mb-2">
            {uploading ? 'Uploading...' : 'Click to upload or take photo'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload homework pages, study material, or take a photo
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            You can select multiple images at once
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            You&apos;ll be able to crop each image before uploading
          </p>
        </label>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {pendingImages.length > 0 && !cropImage && (
        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg">
          Processing {pendingImages.length} image{pendingImages.length > 1 ? 's' : ''}...
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">
            Uploaded Images ({images.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div
                key={index}
                className="relative group bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                <img
                  src={image.preview}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-40 object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cropImage && (
        <ImageCropper
          imageUrl={cropImage.preview}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
