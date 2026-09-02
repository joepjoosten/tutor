'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WebcamCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const NO_FRAMES_TIMEOUT_MS = 4000;

export default function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support webcam access.');
        return;
      }

      try {
        // Plain video constraints: laptops have no "environment" camera, and
        // that constraint can hand back a device that never produces frames.
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = media;
        setStream(media);
      } catch (caughtError) {
        const name = caughtError instanceof Error ? caughtError.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access in your browser and try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : `Camera is not available: ${String(caughtError)}`
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  // Attach the stream exactly when the video element mounts.
  const attachVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element;
      if (element && stream && element.srcObject !== stream) {
        element.srcObject = stream;
        element.play().catch(() => {
          /* muted autoplay is allowed; ignore transient errors */
        });
      }
    },
    [stream]
  );

  // Re-attach if the stream changes while mounted, and warn when the camera
  // yields no frames (seen on some Firefox setups).
  useEffect(() => {
    const element = videoRef.current;
    if (element && stream && element.srcObject !== stream) {
      element.srcObject = stream;
      element.play().catch(() => {});
    }
    if (!stream) return;

    const timeoutId = setTimeout(() => {
      if (videoRef.current && videoRef.current.videoWidth === 0) {
        setError(
          'The camera is not producing an image. Check whether another program is using it and that the browser has camera access.'
        );
      }
    }, NO_FRAMES_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [stream]);

  const handleCancel = () => {
    stopStream();
    onCancel();
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Failed to capture the photo.');
          return;
        }
        const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        const file = new File([blob], `webcam-${timestamp}.jpg`, { type: 'image/jpeg' });
        stopStream();
        onCapture(file);
      },
      'image/jpeg',
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Take a Photo</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Hold the page up to your webcam and take a photo. You can crop it afterwards.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="flex min-h-[45vh] items-center justify-center rounded-xl bg-gray-100 p-2 dark:bg-gray-900/60 sm:min-h-[55vh] sm:p-4">
            {error ? (
              <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
              <video
                ref={attachVideo}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setReady(true)}
                onCanPlay={() => setReady(true)}
                className="max-h-[72vh] max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 p-4 dark:border-gray-700 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg bg-gray-200 px-6 py-3 text-base text-gray-800 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={takePhoto}
            disabled={!ready || Boolean(error)}
            className="rounded-lg bg-blue-600 px-6 py-3 text-base text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {ready ? 'Take Photo' : 'Starting camera…'}
          </button>
        </div>
      </div>
    </div>
  );
}
