/**
 * VAPI / Daily audio helpers.
 *
 * Daily (which Vapi uses under the hood) applies a Krisp noise-cancellation
 * processor on the microphone input. Krisp only supports 16 kHz and 48 kHz
 * sample rates. On machines where the OS exposes the microphone at 192 kHz
 * (common for some USB/high-end interfaces on Windows), Krisp fails to
 * initialise with `KrispInitError: NOT_SUPPORTED_SAMPLE_RATE (192000)`.
 * When that happens, Daily ejects the participant and the Vapi call dies
 * immediately with "Meeting ended due to ejection".
 *
 * The fix here is to pre-acquire the microphone ourselves, push it through
 * a 48 kHz `AudioContext`, and hand Vapi the already-resampled
 * `MediaStreamTrack` via the `audioSource` constructor option. Krisp then
 * receives a 48 kHz stream and initialises cleanly regardless of the OS
 * default sample rate.
 *
 * As a secondary safety net we also expose `disableDailyKrispProcessor` so
 * callers can react to `audio-processor-error` / `call-start-failed` events
 * by swapping the Daily input processor to `none` at runtime.
 */

type DailyInputSettingsUpdater = {
  updateInputSettings: (settings: {
    audio?: { processor?: { type: string } };
  }) => Promise<unknown>;
};

type VapiLike = {
  getDailyCallObject?: () => DailyInputSettingsUpdater | null | undefined;
};

export type VapiAudioResources = {
  sourceStream: MediaStream;
  audioContext: AudioContext;
  normalizedStream: MediaStream;
  normalizedTrack: MediaStreamTrack;
};

const NORMALIZED_SAMPLE_RATE = 48000;

const BASE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
};

const AUDIO_CONSTRAINT_PLANS: MediaTrackConstraints[] = [
  { ...BASE_AUDIO_CONSTRAINTS, sampleRate: { ideal: NORMALIZED_SAMPLE_RATE } },
  { ...BASE_AUDIO_CONSTRAINTS, sampleRate: { exact: NORMALIZED_SAMPLE_RATE } },
  { ...BASE_AUDIO_CONSTRAINTS, sampleRate: { ideal: 16000 } },
  { ...BASE_AUDIO_CONSTRAINTS },
];

export const KRISP_SAMPLE_RATE_ERROR_MESSAGE =
  "Your microphone is running at an unusual sample rate. Medora re-sampled it to 48 kHz and retried. If voice still fails, open Windows Sound settings and set your input device format to 48000 Hz.";

function stopMediaStreamTracks(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Ignore track stop errors – we are tearing down.
    }
  }
}

function createNormalizedStream(sourceStream: MediaStream): {
  audioContext: AudioContext;
  normalizedStream: MediaStream;
  normalizedTrack: MediaStreamTrack;
} {
  const AudioContextCtor =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;

  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available in this environment.");
  }

  const audioContext = new AudioContextCtor({ sampleRate: NORMALIZED_SAMPLE_RATE });
  const sourceNode = audioContext.createMediaStreamSource(sourceStream);
  const destinationNode = audioContext.createMediaStreamDestination();
  sourceNode.connect(destinationNode);

  const normalizedStream = destinationNode.stream;
  const normalizedTrack = normalizedStream.getAudioTracks()[0];
  if (!normalizedTrack) {
    throw new Error("No normalized microphone track was produced.");
  }

  return { audioContext, normalizedStream, normalizedTrack };
}

/**
 * Request the microphone and return a 48 kHz-resampled MediaStream that is
 * safe to hand to Vapi/Daily without tripping Krisp's sample-rate check.
 *
 * Returns `null` only when the browser has no microphone support; for every
 * other failure path (permission denied, no device, etc.) it throws so the
 * caller can surface an actionable error.
 */
export async function createVapiAudioResources(): Promise<VapiAudioResources | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  let lastError: unknown = null;

  for (const constraints of AUDIO_CONSTRAINT_PLANS) {
    let sourceStream: MediaStream | null = null;

    try {
      sourceStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    } catch (error) {
      lastError = error;
      stopMediaStreamTracks(sourceStream);
      continue;
    }

    try {
      const normalized = createNormalizedStream(sourceStream);
      return {
        sourceStream,
        audioContext: normalized.audioContext,
        normalizedStream: normalized.normalizedStream,
        normalizedTrack: normalized.normalizedTrack,
      };
    } catch (error) {
      lastError = error;
      stopMediaStreamTracks(sourceStream);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Unable to initialise microphone for voice call.");
}

export function releaseVapiAudioResources(resources: VapiAudioResources | null): void {
  if (!resources) {
    return;
  }

  try {
    resources.normalizedTrack.stop();
  } catch {
    // Ignore – best effort cleanup.
  }

  stopMediaStreamTracks(resources.normalizedStream);
  stopMediaStreamTracks(resources.sourceStream);

  if (resources.audioContext.state !== "closed") {
    void resources.audioContext.close().catch(() => undefined);
  }
}

export function isKrispSampleRateError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("krispiniterror") ||
    normalized.includes("not_supported_sample_rate") ||
    normalized.includes("error applying mic processor") ||
    normalized.includes("audio-processor-error") ||
    normalized.includes("meeting has ended")
  );
}

/**
 * Merge assistant overrides with Vapi's `backgroundSpeechDenoisingPlan`
 * disabled. This turns off the server-side Fourier / smart denoising plan
 * so Vapi does not double-process an already clean 48 kHz track.
 */
export function withVapiAudioFallback(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...overrides,
    backgroundSpeechDenoisingPlan: {
      smartDenoisingPlan: { enabled: false },
      fourierDenoisingPlan: { enabled: false },
    },
  };
}

/**
 * Tell Daily to stop running the Krisp processor on the current input track.
 * Safe to call after the Vapi call has started; a no-op when the Daily call
 * object is not yet available.
 */
export async function disableDailyKrispProcessor(vapi: VapiLike): Promise<void> {
  const dailyCall = vapi.getDailyCallObject?.();
  if (!dailyCall) {
    return;
  }

  try {
    await dailyCall.updateInputSettings({
      audio: {
        processor: { type: "none" },
      },
    });
  } catch {
    // Best-effort fallback – nothing else we can do from the web SDK.
  }
}
