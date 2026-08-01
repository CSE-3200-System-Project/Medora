/* eslint-disable no-console */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const backendBase = (
  process.env.QA_BACKEND_URL ||
  "https://medora-backend.agreeablebush-6bac3035.eastus.azurecontainerapps.io"
).replace(/\/$/, "");
const patientEmail = process.env.QA_PATIENT_EMAIL;
const patientPassword = process.env.QA_PATIENT_PASSWORD;
const doctorEmail = process.env.QA_DOCTOR_EMAIL;
const doctorPassword = process.env.QA_DOCTOR_PASSWORD;
const allowWrites = process.env.QA_ALLOW_WRITES === "1";
const outputRoot =
  process.env.QA_OUTPUT_DIR ||
  path.join(process.env.TEMP || process.cwd(), "medora-deployed-qa-results");

if (!patientEmail || !patientPassword || !doctorEmail || !doctorPassword) {
  throw new Error("Provide both patient and doctor QA credentials through environment variables.");
}

function loadPublicFrontendEnv() {
  const envText = fs.readFileSync(path.resolve("frontend/.env"), "utf8");
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function authenticate(email, password, supabaseUrl, anonKey) {
  const started = performance.now();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Authentication failed with status ${response.status}.`);
  }
  return { token: payload.access_token, durationMs: Math.round(performance.now() - started) };
}

async function request(token, pathname, options = {}) {
  const started = performance.now();
  const response = await fetch(`${backendBase}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    data,
  };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseTimeLabel(label) {
  const match = String(label).match(/^(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}:00`;
}

function safeError(result) {
  const detail =
    result?.data && typeof result.data === "object"
      ? result.data.detail || result.data.message
      : result?.data;
  return typeof detail === "string" ? detail.slice(0, 300) : null;
}

async function main() {
  const publicEnv = loadPublicFrontendEnv();
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Missing public Supabase configuration.");

  const [patientAuth, doctorAuth] = await Promise.all([
    authenticate(patientEmail, patientPassword, supabaseUrl, anonKey),
    authenticate(doctorEmail, doctorPassword, supabaseUrl, anonKey),
  ]);

  const checks = [];
  const record = (name, result, extra = {}) => {
    checks.push({
      name,
      passed: extra.passed ?? result.ok,
      status: result.status,
      durationMs: result.durationMs,
      error: result.ok ? null : safeError(result),
      ...extra,
    });
  };

  const [patientMe, doctorMe, patientProfile, doctorProfile] = await Promise.all([
    request(patientAuth.token, "/auth/me"),
    request(doctorAuth.token, "/auth/me"),
    request(patientAuth.token, "/profile/patient/profile"),
    request(doctorAuth.token, "/profile/doctor/profile"),
  ]);
  record("patient identity", patientMe, {
    passed: patientMe.ok && /patient/i.test(String(patientMe.data?.role)),
  });
  record("doctor identity", doctorMe, {
    passed: doctorMe.ok && /doctor/i.test(String(doctorMe.data?.role)),
  });
  record("patient profile", patientProfile);
  record("doctor profile", doctorProfile);

  const [patientDeniedDoctor, doctorDeniedPatient] = await Promise.all([
    request(patientAuth.token, "/profile/doctor/profile"),
    request(doctorAuth.token, "/profile/patient/profile"),
  ]);
  record("patient blocked from doctor profile API", patientDeniedDoctor, {
    passed: [401, 403].includes(patientDeniedDoctor.status),
    expectedDenial: true,
  });
  record("doctor blocked from patient profile API", doctorDeniedPatient, {
    passed: [401, 403].includes(doctorDeniedPatient.status),
    expectedDenial: true,
  });

  const doctorId =
    doctorProfile.data?.id ||
    doctorProfile.data?.profile_id ||
    doctorMe.data?.id ||
    doctorMe.data?.profile?.id;
  if (!doctorId) throw new Error("The deployed doctor profile did not expose an ID.");

  const search = await request(
    patientAuth.token,
    `/doctor/search?query=${encodeURIComponent(
      doctorProfile.data?.full_name || doctorProfile.data?.name || "",
    )}`,
  );
  const searchDoctors = search.data?.doctors || [];
  record("patient can find supplied doctor", search, {
    passed: search.ok && searchDoctors.some((doctor) => doctor.id === doctorId),
    resultCount: searchDoctors.length,
  });

  let chosenSlot = null;
  for (let offset = 3; offset <= 17 && !chosenSlot; offset += 1) {
    const date = isoDate(addDays(new Date(), offset));
    const availability = await request(
      patientAuth.token,
      `/availability/${encodeURIComponent(doctorId)}/slots/${date}`,
    );
    const slots = (availability.data?.slot_groups || [])
      .flatMap((group) => group.slots || [])
      .filter((slot) => slot.is_available);
    checks.push({
      name: `availability ${date}`,
      passed: availability.ok,
      status: availability.status,
      durationMs: availability.durationMs,
      availableSlots: slots.length,
      error: availability.ok ? null : safeError(availability),
    });
    if (slots.length) chosenSlot = { date, label: slots[0].time };
  }

  const createdIds = { reminder: null, appointment: null };
  if (allowWrites) {
    const reminder = await request(patientAuth.token, "/reminders/", {
      method: "POST",
      body: JSON.stringify({
        type: "test",
        item_name: "[QA] SoftwareX workflow check",
        reminder_times: ["23:55"],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        timezone: "Asia/Dhaka",
        notes: "Temporary production QA record; safe to remove.",
      }),
    });
    createdIds.reminder = reminder.data?.id || null;
    record("create patient reminder", reminder);

    if (createdIds.reminder) {
      const list = await request(patientAuth.token, "/reminders/");
      const reminders = Array.isArray(list.data) ? list.data : list.data?.reminders || [];
      record("created reminder appears in list", list, {
        passed: list.ok && reminders.some((item) => item.id === createdIds.reminder),
      });
      const remove = await request(
        patientAuth.token,
        `/reminders/${encodeURIComponent(createdIds.reminder)}`,
        { method: "DELETE" },
      );
      record("delete patient reminder", remove);
      if (remove.ok) createdIds.reminder = null;
    }

    if (chosenSlot) {
      const time = parseTimeLabel(chosenSlot.label);
      const appointment = await request(patientAuth.token, "/appointment/", {
        method: "POST",
        headers: { "Idempotency-Key": `qa-${Date.now()}-${Math.random().toString(16).slice(2)}` },
        body: JSON.stringify({
          doctor_id: doctorId,
          appointment_date: `${chosenSlot.date}T${time || "00:00:00"}Z`,
          reason: "[QA] SoftwareX deployed workflow validation",
          notes: `Temporary production QA request. Slot: ${chosenSlot.label}`,
        }),
      });
      createdIds.appointment = appointment.data?.id || null;
      record("create patient appointment request", appointment, {
        createdStatus: appointment.data?.status || null,
      });

      if (createdIds.appointment) {
        const patientAppointments = await request(
          patientAuth.token,
          "/appointment/my-appointments?limit=100",
        );
        const patientItems = Array.isArray(patientAppointments.data)
          ? patientAppointments.data
          : patientAppointments.data?.items || patientAppointments.data?.appointments || [];
        record("patient sees appointment request", patientAppointments, {
          passed:
            patientAppointments.ok &&
            patientItems.some((item) => item.id === createdIds.appointment),
        });

        const doctorAppointments = await request(
          doctorAuth.token,
          "/appointment/my-appointments?limit=100",
        );
        const doctorItems = Array.isArray(doctorAppointments.data)
          ? doctorAppointments.data
          : doctorAppointments.data?.items || doctorAppointments.data?.appointments || [];
        record("doctor cannot see pre-approval request", doctorAppointments, {
          passed:
            doctorAppointments.ok &&
            !doctorItems.some((item) => item.id === createdIds.appointment),
        });

        const remove = await request(
          patientAuth.token,
          `/appointment/${encodeURIComponent(createdIds.appointment)}/pending-request`,
          { method: "DELETE" },
        );
        record("withdraw pending appointment request", remove);
        if (remove.ok) createdIds.appointment = null;
      }
    } else {
      checks.push({
        name: "create patient appointment request",
        passed: false,
        skipped: true,
        reason: "The supplied doctor has no available slot in the next 17 days.",
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    backendBase,
    allowWrites,
    authenticationMs: {
      patient: patientAuth.durationMs,
      doctor: doctorAuth.durationMs,
    },
    chosenSlot: chosenSlot ? { date: chosenSlot.date, available: true } : null,
    cleanupComplete: !createdIds.reminder && !createdIds.appointment,
    checks,
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(
    path.join(outputRoot, "workflow-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        allowWrites,
        authenticationMs: report.authenticationMs,
        chosenSlot: report.chosenSlot,
        cleanupComplete: report.cleanupComplete,
        passed: checks.filter((item) => item.passed).length,
        failed: checks.filter((item) => !item.passed && !item.skipped).length,
        skipped: checks.filter((item) => item.skipped).length,
        checks,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
