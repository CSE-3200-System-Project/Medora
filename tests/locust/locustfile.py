from __future__ import annotations

import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from locust import HttpUser, between, events, tag, task


PATIENT_TOKEN = os.getenv("MEDORA_PATIENT_TOKEN", "patient-token")
DOCTOR_TOKEN = os.getenv("MEDORA_DOCTOR_TOKEN", "doctor-token")
DOCTOR_IDS = [item.strip() for item in os.getenv("MEDORA_DOCTOR_IDS", "").split(",") if item.strip()]
REPORT_PATH = Path(os.getenv("MEDORA_LOCUST_SUMMARY_PATH", "tests/benchmarks/reports/current/locust_summary.json"))

_CREATED_APPOINTMENTS: list[str] = []


def _future_iso(days: int = 1) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).isoformat()


class MedoraHealthcareUser(HttpUser):
    wait_time = between(0.3, 2.5)

    def on_start(self) -> None:
        self.patient_headers = {"Authorization": f"Bearer {PATIENT_TOKEN}"}
        self.doctor_headers = {"Authorization": f"Bearer {DOCTOR_TOKEN}"}
        self.doctor_id = random.choice(DOCTOR_IDS) if DOCTOR_IDS else str(uuid.uuid4())

    @task(6)
    @tag("peak_booking")
    def peak_booking_hour(self) -> None:
        payload = {
            "doctor_id": self.doctor_id,
            "appointment_date": _future_iso(days=2),
            "reason": "Peak booking hour synthetic request",
            "notes": f"Slot: {random.choice(['8:00 PM', '8:30 PM', '9:00 PM'])}",
        }
        with self.client.post(
            "/appointment/",
            json=payload,
            headers=self.patient_headers,
            name="peak_booking:create_appointment",
            catch_response=True,
        ) as response:
            if response.status_code in {200, 201}:
                try:
                    appointment_id = response.json().get("id")
                    if appointment_id:
                        _CREATED_APPOINTMENTS.append(appointment_id)
                except Exception:
                    pass
                response.success()
            else:
                response.failure(f"booking failed: {response.status_code}")

    @task(4)
    @tag("ocr_burst")
    def ocr_burst_uploads(self) -> None:
        fake_png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02"
            b"\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with self.client.post(
            "/upload/prescription/extract",
            data={"save_file": "false"},
            files={"file": ("lab-report.png", fake_png, "image/png")},
            headers=self.patient_headers,
            name="ocr_burst:extract_prescription",
            catch_response=True,
        ) as response:
            if response.status_code in {200, 201}:
                response.success()
            else:
                response.failure(f"ocr burst failed: {response.status_code}")

    @task(5)
    @tag("ai_heavy")
    def ai_heavy_usage(self) -> None:
        symptoms = random.choice(
            [
                "আমার chest pain হচ্ছে ২ দিন ধরে",
                "Need doctor for severe cough and fever",
                "Persistent headache and blurred vision",
            ]
        )
        with self.client.post(
            "/ai/search",
            json={"user_text": symptoms, "consultation_mode": random.choice(["online", "offline", "both"])},
            headers=self.patient_headers,
            name="ai_heavy:doctor_search",
            catch_response=True,
        ) as response:
            if response.status_code in {200, 201}:
                response.success()
            else:
                response.failure(f"ai search failed: {response.status_code}")

    @task(2)
    @tag("reminder_spike")
    def reminder_dispatch_spike(self) -> None:
        with self.client.get(
            "/reminders",
            headers=self.patient_headers,
            name="reminder_spike:list_reminders",
            catch_response=True,
        ) as response:
            if response.status_code in {200, 404}:
                response.success()
            else:
                response.failure(f"reminder list failed: {response.status_code}")

    @task(6)
    @tag("mixed_workload")
    def mixed_workload(self) -> None:
        action = random.choice(
            [
                ("GET", "/health", None, None, "mixed:health"),
                ("GET", "/appointment/my-appointments", None, self.patient_headers, "mixed:my_appointments"),
                ("GET", "/appointment/stats", None, self.doctor_headers, "mixed:doctor_stats"),
                ("POST", "/ai/search", {"user_text": "Need ENT specialist", "consultation_mode": "online"}, self.patient_headers, "mixed:ai_search"),
            ]
        )
        method, path, payload, headers, name = action
        if method == "GET":
            self.client.get(path, headers=headers, name=name)
        else:
            self.client.post(path, json=payload, headers=headers, name=name)


@events.quitting.add_listener
def write_summary(environment, **kwargs) -> None:  # noqa: ANN001
    stats = environment.stats.total
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "requests": stats.num_requests,
        "failures": stats.num_failures,
        "error_rate": stats.fail_ratio,
        "avg_response_time_ms": stats.avg_response_time,
        "p50_ms": stats.get_current_response_time_percentile(0.50),
        "p95_ms": stats.get_current_response_time_percentile(0.95),
        "p99_ms": stats.get_current_response_time_percentile(0.99),
        "rps": stats.total_rps,
        "created_appointments": len(_CREATED_APPOINTMENTS),
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
