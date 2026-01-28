"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceRecorderState = 
  | "idle" 
  | "recording" 
  | "processing" 
  | "review" 
  | "error";

interface UseVoiceRecorderOptions {
  maxDuration?: number; // Maximum recording duration in seconds
  onRecordingComplete?: (audioBlob: Blob) => void;
}

interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  audioBlob: Blob | null;
  error: string | null;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecorder: () => void;
  isSupported: boolean;
}

/**
 * Custom hook for voice recording using the MediaRecorder API.
 * 
 * Features:
 * - Records audio in webm or wav format
 * - Max duration of 60 seconds (configurable)
 * - Handles microphone permissions
 * - Provides recording state management
 */
export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { maxDuration = 60, onRecordingComplete } = options;

  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check browser support
  const isSupported = typeof window !== "undefined" && 
    !!navigator.mediaDevices && 
    !!navigator.mediaDevices.getUserMedia;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser");
      setState("error");
      return;
    }

    try {
      setError(null);
      setState("recording");
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      // Determine best supported format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") 
        ? "audio/webm" 
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setState("processing");
        
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setState("error");
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);

    } catch (err: any) {
      // Handle permission denied or other errors
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError("Failed to start recording. Please try again.");
      }
      setState("error");
    }
  }, [isSupported, maxDuration, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecorder = useCallback(() => {
    // Stop any ongoing recording
    stopRecording();

    // Clean up stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset state
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    setState("idle");
    chunksRef.current = [];
  }, [stopRecording]);

  return {
    state,
    audioBlob,
    error,
    duration,
    startRecording,
    stopRecording,
    resetRecorder,
    isSupported
  };
}
