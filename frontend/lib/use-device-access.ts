"use client";

import { useState, useRef, useCallback } from "react";

// ── Camera Access ──

type CameraOptions = {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (options: CameraOptions = {}) => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: options.facingMode || "environment",
            width: options.width ? { ideal: options.width } : undefined,
            height: options.height ? { ideal: options.height } : undefined,
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsActive(true);
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in your browser settings."
            : "Failed to access camera.";
        setError(message);
      }
    },
    [],
  );

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  return { videoRef, isActive, error, start, stop, capturePhoto };
}

// ── Location Access ──

type LocationState = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
};

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: false,
  });

  const getCurrentPosition = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocation((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser.",
      }));
      return;
    }

    setLocation((prev) => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          isLoading: false,
        });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Location unavailable."
              : "Location request timed out.";
        setLocation((prev) => ({
          ...prev,
          error: message,
          isLoading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    );
  }, []);

  return { ...location, getCurrentPosition };
}

// ── File Access ──

type FilePickerOptions = {
  accept?: string;
  multiple?: boolean;
  capture?: "user" | "environment";
};

export function useFilePicker() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pickFiles = useCallback((options: FilePickerOptions = {}) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept || "*/*";
    input.multiple = options.multiple || false;
    if (options.capture) {
      input.capture = options.capture;
    }

    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        setFiles(Array.from(input.files));
        setError(null);
      }
    };

    inputRef.current = input;
    input.click();
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return { files, error, pickFiles, clearFiles };
}
