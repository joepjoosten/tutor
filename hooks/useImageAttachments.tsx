'use client';

import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import ImageCropper from '@/components/ImageCropper';
import WebcamCapture from '@/components/WebcamCapture';
import { compressImage } from '@/lib/compressImage';

export interface AttachedImage {
  id: Id<'images'>;
  url: string | null;
  preview: string;
}

interface PendingImage {
  file: File;
  preview: string;
}

function readPreview(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function isDesktop() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

/**
 * Photos attached to a chat message: pick or capture, crop, compress, upload
 * to Convex, and keep the uploaded ids until the message is sent.
 */
export function useImageAttachments() {
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const saveUploadedImage = useMutation(api.images.saveUploadedImage);
  const deleteImage = useMutation(api.images.deleteImage);

  const [images, setImages] = useState<AttachedImage[]>([]);
  const [pendingCrops, setPendingCrops] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  const pickInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const cropImage = pendingCrops[0] ?? null;

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    const newPending = await Promise.all(
      files.map(async (file) => ({ file, preview: await readPreview(file) }))
    );
    setPendingCrops((current) => [...current, ...newPending]);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      void addFiles(Array.from(files));
    }
    event.target.value = '';
  };

  const choosePhotos = () => pickInputRef.current?.click();

  /** Desktop: webcam modal. Mobile: the native camera through a file input. */
  const takePhoto = () => {
    if (isDesktop() && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      setWebcamOpen(true);
    } else {
      captureInputRef.current?.click();
    }
  };

  const handleCropComplete = async (croppedBlob: Blob, croppedDataUrl: string) => {
    if (!cropImage) return;
    setUploading(true);
    setPendingCrops((current) => current.slice(1));

    try {
      let fileToUpload: Blob = croppedBlob;
      if (croppedBlob.size > 1024 * 1024) {
        try {
          fileToUpload = await compressImage(croppedBlob, 1024);
        } catch (compressError) {
          console.error('Compression failed, using cropped image:', compressError);
        }
      }

      const uploadMimeType = fileToUpload.type || cropImage.file.type || 'image/jpeg';
      const postUrl = await generateUploadUrl({});
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': uploadMimeType },
        body: fileToUpload,
      });
      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await response.json();
      const image = await saveUploadedImage({
        storageId,
        filename: cropImage.file.name,
        mimeType: uploadMimeType,
        size: fileToUpload.size,
      });

      setImages((current) => [
        ...current,
        { id: image._id, url: image.url ?? null, preview: croppedDataUrl },
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setPendingCrops((current) => current.slice(1));
  };

  const remove = async (index: number) => {
    const image = images[index];
    setImages((current) => current.filter((_, i) => i !== index));
    if (image) {
      try {
        await deleteImage({ imageId: image.id });
      } catch (deleteError) {
        console.error('Failed to delete image:', deleteError);
      }
    }
  };

  /** Hands the attachments over to a sent message and empties the strip. */
  const take = () => {
    const taken = images;
    setImages([]);
    return taken;
  };

  const inputs = (
    <>
      <input
        ref={pickInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleInputChange}
      />
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleInputChange}
      />
    </>
  );

  const modals = (
    <>
      {webcamOpen && (
        <WebcamCapture
          onCapture={(file) => {
            setWebcamOpen(false);
            void addFiles([file]);
          }}
          onCancel={() => setWebcamOpen(false)}
        />
      )}
      {cropImage && (
        <ImageCropper
          imageUrl={cropImage.preview}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );

  return {
    images,
    uploading,
    queued: pendingCrops.length,
    error,
    clearError: () => setError(null),
    choosePhotos,
    takePhoto,
    remove,
    take,
    inputs,
    modals,
  };
}
