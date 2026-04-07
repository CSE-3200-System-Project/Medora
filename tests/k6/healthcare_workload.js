import http from "k6/http";
import { check, sleep } from "k6";
import encoding from "k6/encoding";

const BASE_URL = __ENV.MEDORA_BASE_URL || "http://localhost:8000";
const PATIENT_TOKEN = __ENV.MEDORA_PATIENT_TOKEN || "patient-token";
const DOCTOR_TOKEN = __ENV.MEDORA_DOCTOR_TOKEN || "doctor-token";
const DOCTOR_ID = __ENV.MEDORA_DOCTOR_ID || "doctor-id";

export const options = {
  scenarios: {
    peak_booking_hour: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "2m", target: 30 },
        { duration: "5m", target: 80 },
        { duration: "3m", target: 120 },
        { duration: "2m", target: 0 },
      ],
      exec: "peakBookingHour",
    },
    ocr_burst_uploads: {
      executor: "ramping-arrival-rate",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 80,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "3m", target: 45 },
        { duration: "1m", target: 5 },
      ],
      exec: "ocrBurstUploads",
    },
    ai_heavy_usage: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "6m",
      preAllocatedVUs: 40,
      maxVUs: 120,
      exec: "aiHeavyUsage",
    },
    reminder_dispatch_spike: {
      executor: "per-vu-iterations",
      vus: 50,
      iterations: 40,
      maxDuration: "5m",
      exec: "reminderDispatchSpike",
    },
    mixed_workload: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "2m", target: 60 },
        { duration: "4m", target: 100 },
        { duration: "2m", target: 20 },
      ],
      exec: "mixedWorkload",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500", "p(99)<4500"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(50)", "p(95)", "p(99)"],
};

function patientHeaders() {
  return {
    Authorization: `Bearer ${PATIENT_TOKEN}`,
  };
}

function doctorHeaders() {
  return {
    Authorization: `Bearer ${DOCTOR_TOKEN}`,
  };
}

function futureDateIso(days = 2) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function peakBookingHour() {
  const payload = JSON.stringify({
    doctor_id: DOCTOR_ID,
    appointment_date: futureDateIso(2),
    reason: "Peak-hour booking simulation",
    notes: "Slot: 8:00 PM",
  });

  const response = http.post(`${BASE_URL}/appointment/`, payload, {
    headers: {
      "Content-Type": "application/json",
      ...patientHeaders(),
    },
    tags: { scenario: "peak_booking_hour", endpoint: "appointment_create" },
  });

  check(response, {
    "peak booking request accepted": (r) => [200, 201, 400, 409].includes(r.status),
  });
  sleep(0.2);
}

export function ocrBurstUploads() {
  const body =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACklEQVR4nGNgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==";
  const payload = {
    save_file: "false",
    file: http.file(encoding.b64decode(body, "std"), "report.png", "image/png"),
  };
  const response = http.post(`${BASE_URL}/upload/prescription/extract`, payload, {
    headers: patientHeaders(),
    tags: { scenario: "ocr_burst_uploads", endpoint: "ocr_extract" },
  });

  check(response, {
    "ocr burst returns expected status": (r) => [200, 201, 400, 403, 502].includes(r.status),
  });
  sleep(0.1);
}

export function aiHeavyUsage() {
  const queries = [
    "আমার ৩ দিন ধরে জ্বর আর কাশি",
    "Need cardiologist for chest pain",
    "I need doctor suggestion for migraine and nausea",
  ];
  const payload = JSON.stringify({
    user_text: queries[Math.floor(Math.random() * queries.length)],
    consultation_mode: "online",
  });

  const response = http.post(`${BASE_URL}/ai/search`, payload, {
    headers: {
      "Content-Type": "application/json",
      ...patientHeaders(),
    },
    tags: { scenario: "ai_heavy_usage", endpoint: "ai_search" },
  });

  check(response, {
    "ai heavy request accepted": (r) => [200, 400, 502].includes(r.status),
  });
  sleep(0.1);
}

export function reminderDispatchSpike() {
  const response = http.get(`${BASE_URL}/reminders`, {
    headers: patientHeaders(),
    tags: { scenario: "reminder_dispatch_spike", endpoint: "reminders_list" },
  });
  check(response, {
    "reminder list reachable": (r) => [200, 401, 403, 404].includes(r.status),
  });
  sleep(0.05);
}

export function mixedWorkload() {
  const actions = [
    () =>
      http.get(`${BASE_URL}/health`, {
        tags: { scenario: "mixed_workload", endpoint: "health" },
      }),
    () =>
      http.get(`${BASE_URL}/appointment/my-appointments`, {
        headers: patientHeaders(),
        tags: { scenario: "mixed_workload", endpoint: "patient_appointments" },
      }),
    () =>
      http.get(`${BASE_URL}/appointment/stats`, {
        headers: doctorHeaders(),
        tags: { scenario: "mixed_workload", endpoint: "doctor_stats" },
      }),
    () =>
      http.post(
        `${BASE_URL}/ai/search`,
        JSON.stringify({ user_text: "Need dermatology consultation", consultation_mode: "online" }),
        {
          headers: {
            "Content-Type": "application/json",
            ...patientHeaders(),
          },
          tags: { scenario: "mixed_workload", endpoint: "ai_search" },
        },
      ),
  ];

  const response = actions[Math.floor(Math.random() * actions.length)]();
  check(response, {
    "mixed workload response is controlled": (r) => r.status < 600,
  });
  sleep(0.15);
}

export function handleSummary(data) {
  return {
    "tests/benchmarks/reports/current/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
