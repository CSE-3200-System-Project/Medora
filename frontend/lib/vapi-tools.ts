/**
 * Shared Medora ↔ VAPI integration: tool definitions, assistant overrides,
 * client-side tool-call handlers, and navigation resolution.
 *
 * Used by chorui-vapi-voice-control.tsx (and potentially other VAPI voice
 * components) to give the VAPI assistant full system-aware capabilities
 * that mirror the Chorui AI text chat.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Navigation registries (mirrors backend _CHORUI_{PATIENT,DOCTOR}_NAVIGATION)
// ---------------------------------------------------------------------------

type NavigationEntry = {
  label: string;
  path: string;
  keywords: string[];
};

const PATIENT_NAVIGATION: NavigationEntry[] = [
  { label: "Patient Home", path: "/patient/home", keywords: ["home", "dashboard", "main page", "overview"] },
  { label: "Find Doctor", path: "/patient/find-doctor", keywords: ["find doctor", "search doctor", "specialist", "doctor list"] },
  { label: "Appointments", path: "/patient/appointments", keywords: ["appointment", "appointments", "book appointment", "upcoming visit"] },
  { label: "My Prescriptions", path: "/patient/my-prescriptions", keywords: ["prescription", "prescriptions", "medicine list", "medication"] },
  { label: "Medical History", path: "/patient/medical-history", keywords: ["medical history", "health history", "conditions", "allergies"] },
  { label: "Medical Reports", path: "/patient/medical-reports", keywords: ["medical report", "lab report", "upload report", "blood test", "test result"] },
  { label: "Find Medicine", path: "/patient/find-medicine", keywords: ["find medicine", "search medicine", "pharmacy", "drug search"] },
  { label: "Reminders", path: "/patient/reminders", keywords: ["reminder", "reminders", "medicine reminder", "alert"] },
  { label: "Analytics", path: "/patient/analytics", keywords: ["analytics", "trends", "charts", "statistics", "health insights"] },
  { label: "Chorui AI", path: "/patient/chorui-ai", keywords: ["chorui", "ai assistant", "ai workspace"] },
  { label: "Profile", path: "/patient/profile", keywords: ["profile", "my profile", "account", "personal info"] },
  { label: "Privacy & Sharing", path: "/patient/privacy", keywords: ["privacy", "data sharing", "consent", "permissions"] },
  { label: "Notifications", path: "/notifications", keywords: ["notification", "notifications", "inbox", "alerts"] },
  { label: "Settings", path: "/settings", keywords: ["settings", "preferences", "language", "theme"] },
];

const DOCTOR_NAVIGATION: NavigationEntry[] = [
  { label: "Doctor Home", path: "/doctor/home", keywords: ["home", "dashboard", "main page", "overview"] },
  { label: "My Patients", path: "/doctor/patients", keywords: ["patients", "my patients", "patient list", "active patients"] },
  { label: "Schedule", path: "/doctor/schedule", keywords: ["schedule", "availability", "slots", "calendar", "working hours"] },
  { label: "Appointments", path: "/doctor/appointments", keywords: ["appointment", "appointments", "upcoming", "bookings"] },
  { label: "Analytics", path: "/doctor/analytics", keywords: ["analytics", "metrics", "statistics", "insights", "trends"] },
  { label: "Find Medicine", path: "/doctor/find-medicine", keywords: ["find medicine", "search medicine", "drug lookup", "interactions"] },
  { label: "Chorui AI", path: "/doctor/chorui-ai", keywords: ["chorui", "ai assistant", "ai workspace"] },
  { label: "Profile", path: "/doctor/profile", keywords: ["profile", "my profile", "account", "credentials"] },
  { label: "Notifications", path: "/notifications", keywords: ["notification", "notifications", "inbox", "alerts"] },
  { label: "Settings", path: "/settings", keywords: ["settings", "preferences", "language", "theme"] },
];

// ---------------------------------------------------------------------------
// Route resolution from tool-call arguments
// ---------------------------------------------------------------------------

export type MedoraRoleContext = "patient" | "doctor";

export type ResolvedNavigation = {
  route: string;
  label: string;
};

function getRegistry(role: MedoraRoleContext): NavigationEntry[] {
  return role === "doctor" ? DOCTOR_NAVIGATION : PATIENT_NAVIGATION;
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function isRoleAllowed(route: string, role: MedoraRoleContext): boolean {
  if (route.startsWith("/admin")) return false;
  if (route === "/settings" || route === "/notifications") return true;
  if (role === "patient") return route === "/patient" || route.startsWith("/patient/");
  return route === "/doctor" || route.startsWith("/doctor/");
}

function matchNavigationByKeywords(
  text: string,
  role: MedoraRoleContext,
): NavigationEntry | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const registry = getRegistry(role);
  let bestScore = 0;
  let bestEntry: NavigationEntry | null = null;

  for (const entry of registry) {
    let score = 0;
    const labelLower = entry.label.toLowerCase();
    if (normalized.includes(labelLower) || labelLower.includes(normalized)) {
      score += 6;
    }
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.includes(" ") ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore > 0 ? bestEntry : null;
}

export function resolveVapiNavigation(
  args: Record<string, unknown>,
  role: MedoraRoleContext,
): ResolvedNavigation | null {
  const explicitRoute = safeString(args.route);
  if (explicitRoute && explicitRoute.startsWith("/")) {
    if (!isRoleAllowed(explicitRoute, role)) return null;
    const tail = explicitRoute.split("/").filter(Boolean).pop() || "page";
    const label = tail.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { route: explicitRoute, label };
  }

  const destination =
    safeString(args.destination) ||
    safeString(args.target) ||
    safeString(args.page) ||
    safeString(args.message) ||
    safeString(args.query);

  if (!destination) return null;

  const entry = matchNavigationByKeywords(destination, role);
  if (!entry) return null;

  return { route: entry.path, label: entry.label };
}

// ---------------------------------------------------------------------------
// Tool-call extraction from Vapi message events
// ---------------------------------------------------------------------------

export type VapiToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export function extractVapiToolCalls(message: unknown): VapiToolCall[] {
  if (!message || typeof message !== "object") return [];
  const msg = message as Record<string, unknown>;

  if (msg.type !== "tool-calls") return [];

  const calls: VapiToolCall[] = [];

  const toolCallList = msg.toolCallList;
  if (Array.isArray(toolCallList)) {
    for (const item of toolCallList) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const fn = record.function;
      if (fn && typeof fn === "object") {
        const fnRecord = fn as Record<string, unknown>;
        calls.push({
          id: safeString(record.id) || safeString(fnRecord.id) || "",
          name: normalizeText(safeString(fnRecord.name)),
          arguments: parseArgs(fnRecord.arguments),
        });
      } else {
        calls.push({
          id: safeString(record.id) || "",
          name: normalizeText(safeString(record.name)),
          arguments: parseArgs(record.arguments),
        });
      }
    }
  }

  const toolWithToolCallList = msg.toolWithToolCallList;
  if (Array.isArray(toolWithToolCallList)) {
    for (const wrapped of toolWithToolCallList) {
      if (!wrapped || typeof wrapped !== "object") continue;
      const w = wrapped as Record<string, unknown>;
      const toolCall = w.toolCall;
      if (!toolCall || typeof toolCall !== "object") continue;
      const tc = toolCall as Record<string, unknown>;
      const fn = tc.function;
      if (fn && typeof fn === "object") {
        const fnRecord = fn as Record<string, unknown>;
        calls.push({
          id: safeString(tc.id) || "",
          name: normalizeText(safeString(fnRecord.name) || safeString(w.name)),
          arguments: parseArgs(fnRecord.parameters || fnRecord.arguments),
        });
      }
    }
  }

  return calls;
}

export const MEDORA_CLIENT_ACTION_TOOLS = new Set([
  "navigate_medora",
  "navigate",
  "end_voice_call",
]);

// ---------------------------------------------------------------------------
// Assistant overrides builder
// ---------------------------------------------------------------------------

type MedoraVapiOverridesOptions = {
  roleContext: MedoraRoleContext;
  patientId: string;
  sessionToken: string;
  currentRoute: string;
  locale: string;
};

function buildToolServerUrl(): string {
  return `${BACKEND_URL}/ai/vapi/tools/chorui`;
}

function pageLabel(route: string, role: MedoraRoleContext): string {
  const registry = getRegistry(role);
  for (const entry of registry) {
    if (entry.path === route) return entry.label;
  }
  const tail = route.split("/").filter(Boolean).pop() || "";
  return tail.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildAvailablePagesText(role: MedoraRoleContext): string {
  return getRegistry(role)
    .map((e) => `${e.label} → ${e.path}`)
    .join("\n");
}

function buildSystemPrompt(opts: MedoraVapiOverridesOptions): string {
  const roleLabel = opts.roleContext === "doctor" ? "Doctor" : "Patient";
  const pages = buildAvailablePagesText(opts.roleContext);
  const currentLabel = pageLabel(opts.currentRoute, opts.roleContext);

  return [
    `You are Chorui, the Medora healthcare AI voice assistant. The user is a signed-in ${roleLabel}.`,
    `They are currently viewing: ${currentLabel} (${opts.currentRoute}).`,
    `UI language: ${opts.locale === "bn" ? "Bangla" : "English"}.`,
    "",
    "Your capabilities via tool calls:",
    "• ask_chorui — Answer any health, medical, or Medora system question using the full Chorui AI pipeline.",
    "• navigate_medora — Navigate to a Medora page. Always provide a 'destination' (natural text) AND 'route' (exact path). Available pages:",
    pages,
    "• get_upcoming_appointments — List the user's upcoming appointments.",
    opts.roleContext === "doctor"
      ? "• find_patient — Search for a patient by name, ID, or condition (doctor only)."
      : "",
    "• summarize_prescription — Explain a prescription. Requires 'prescription_id'.",
    "• get_voice_context — Get the current Medora session context.",
    "• end_voice_call — End this voice session when the user wants to stop.",
    "",
    "Behavior rules:",
    "- Keep spoken answers SHORT and natural — 2-3 sentences max unless the user asks for detail.",
    "- For navigation, always call navigate_medora with the exact route from the list above. Do NOT guess routes.",
    "- Never make up medical diagnoses. You can summarize what's in the user's Medora record.",
    "- Be warm and professional. This is healthcare — no jokes, but stay human.",
    "- If the user speaks Bangla, respond in Bangla.",
    "- If you don't understand what the user wants, ask a clarifying question.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildToolDefinitions(
  opts: MedoraVapiOverridesOptions,
): Record<string, unknown>[] {
  const serverUrl = buildToolServerUrl();
  const sharedServer = { url: serverUrl };

  const tools: Record<string, unknown>[] = [
    {
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "ask_chorui",
        description:
          "Ask the Chorui AI any question about health, medical data, appointments, prescriptions, or the Medora platform. Always include the user's full question as the message.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The user's question or request, verbatim.",
            },
          },
          required: ["message"],
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Let me check that for you.",
        },
      ],
    },
    {
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "navigate_medora",
        description:
          "Navigate the user to a specific Medora page. Provide a natural-language destination AND the exact route path from the available pages list.",
        parameters: {
          type: "object",
          properties: {
            destination: {
              type: "string",
              description:
                "Natural-language description of where the user wants to go, e.g. 'my appointments'.",
            },
            route: {
              type: "string",
              description:
                "The exact route path from the available pages list, e.g. '/patient/appointments'.",
            },
          },
          required: ["destination"],
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Opening that for you.",
        },
      ],
    },
    {
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "get_upcoming_appointments",
        description:
          "Get the user's upcoming appointments or schedule from Medora.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "How many appointments to return (1-10). Default 5.",
            },
          },
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Checking your schedule.",
        },
      ],
    },
    {
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "summarize_prescription",
        description:
          "Explain a prescription in plain language. Requires the prescription ID.",
        parameters: {
          type: "object",
          properties: {
            prescription_id: {
              type: "string",
              description: "The Medora prescription ID to explain.",
            },
          },
          required: ["prescription_id"],
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Reading your prescription.",
        },
      ],
    },
    {
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "get_voice_context",
        description:
          "Get the current Medora voice session context: role, current page, next appointment, etc.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      async: true,
      server: sharedServer,
      function: {
        name: "end_voice_call",
        description:
          "End the current voice session when the user wants to stop talking.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Goodbye! Tap Start Voice any time to talk again.",
        },
      ],
    },
  ];

  if (opts.roleContext === "doctor") {
    tools.push({
      type: "function",
      async: false,
      server: sharedServer,
      function: {
        name: "find_patient",
        description:
          "Search for a patient by name, ID, or condition. Doctor only.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Patient name, patient reference ID, or medical condition to search for.",
            },
          },
          required: ["query"],
        },
      },
      messages: [
        {
          type: "request-start",
          content: "Searching your patients.",
        },
      ],
    });
  }

  return tools;
}

export function buildMedoraAssistantOverrides(
  opts: MedoraVapiOverridesOptions,
): Record<string, unknown> {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    variableValues: {
      medora_role_context: opts.roleContext,
      medora_patient_id: opts.patientId,
      medora_session_token: opts.sessionToken,
      medora_current_route: opts.currentRoute,
      medora_current_page_label: pageLabel(opts.currentRoute, opts.roleContext),
      medora_locale: opts.locale,
      medora_today: today,
      medora_available_pages: buildAvailablePagesText(opts.roleContext),
    },
    metadata: {
      role_context: opts.roleContext,
      patient_id: opts.patientId,
      session_token: opts.sessionToken,
      current_route: opts.currentRoute,
      current_page_label: pageLabel(opts.currentRoute, opts.roleContext),
      locale: opts.locale,
      source: "medora-chorui-voice",
    },
    clientMessages: [
      "conversation-update",
      "function-call",
      "model-output",
      "speech-update",
      "status-update",
      "transcript",
      "tool-calls",
      "tool-calls-result",
      "user-interrupted",
    ],
    firstMessage:
      opts.roleContext === "doctor"
        ? "Hello, doctor. I am Chorui, your Medora voice assistant. You can ask me about your patients, schedule, or anything in Medora. How can I help?"
        : "Hi! I am Chorui, your Medora voice assistant. You can ask me about your health, appointments, prescriptions, or navigate anywhere in Medora. What can I do for you?",
    model: {
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(opts),
        },
      ],
    },
    "tools:append": buildToolDefinitions(opts),
  };
}

export function buildMedoraFirstMessage(role: MedoraRoleContext): string {
  return role === "doctor"
    ? "Hello, doctor. I am Chorui, your Medora voice assistant. How can I help?"
    : "Hi! I am Chorui, your Medora voice assistant. What can I do for you?";
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return "";
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return {};
    }
  }
  return {};
}
