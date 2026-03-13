import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

declare global {
  interface Window {
    __medoraVitalsInitialized?: boolean;
  }
}

const DEFAULT_SAMPLE_RATE = 0.1;
const METRICS_ENDPOINT = "/api/perf/vitals";

function getSampleRate(): number {
  const configured = Number(process.env.NEXT_PUBLIC_RUM_SAMPLE_RATE ?? DEFAULT_SAMPLE_RATE);
  if (!Number.isFinite(configured)) {
    return DEFAULT_SAMPLE_RATE;
  }
  return Math.min(1, Math.max(0, configured));
}

function shouldSample(): boolean {
  return Math.random() <= getSampleRate();
}

function getSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendMetric(metric: Metric, sessionId: string) {
  const payload = {
    id: metric.id,
    name: metric.name,
    value: Number(metric.value.toFixed(2)),
    delta: Number(metric.delta.toFixed(2)),
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: `${window.location.pathname}${window.location.search}`,
    ts: Date.now(),
    sessionId,
    userAgent: navigator.userAgent,
  };

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(METRICS_ENDPOINT, blob);
    return;
  }

  fetch(METRICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore client telemetry errors.
  });
}

if (typeof window !== "undefined" && !window.__medoraVitalsInitialized && shouldSample()) {
  window.__medoraVitalsInitialized = true;
  const sessionId = getSessionId();
  const report = (metric: Metric) => sendMetric(metric, sessionId);

  onTTFB(report);
  onFCP(report);
  onLCP(report);
  onCLS(report);
  onINP(report);
}
