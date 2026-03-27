export type MedicalModuleTab =
  | "medications"
  | "tests"
  | "surgeries"
  | "hospitalizations"
  | "vaccinations"
  | "visits"
  | "reports";

interface ModuleAccentStyles {
  tabIconText: string;
  tabActiveState: string;
  timelineStripeBg: string;
  timelineBadge: string;
  timelineToggle: string;
}

export const MEDICAL_MODULE_TAB_ACCENTS: Record<MedicalModuleTab, ModuleAccentStyles> = {
  medications: {
    tabIconText: "text-primary",
    tabActiveState: "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    timelineStripeBg: "bg-primary/10",
    timelineBadge: "bg-primary/10 text-primary",
    timelineToggle: "text-primary hover:text-primary/80",
  },
  tests: {
    tabIconText: "text-purple-600 dark:text-purple-400",
    tabActiveState: "data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/40 dark:data-[state=active]:text-purple-300",
    timelineStripeBg: "bg-purple-50 dark:bg-purple-900/25",
    timelineBadge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    timelineToggle: "text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200",
  },
  surgeries: {
    tabIconText: "text-orange-600 dark:text-orange-400",
    tabActiveState: "data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-900/40 dark:data-[state=active]:text-orange-300",
    timelineStripeBg: "bg-orange-50 dark:bg-orange-900/25",
    timelineBadge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    timelineToggle: "text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200",
  },
  hospitalizations: {
    tabIconText: "text-indigo-600 dark:text-indigo-400",
    tabActiveState: "data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/40 dark:data-[state=active]:text-indigo-300",
    timelineStripeBg: "bg-indigo-50 dark:bg-indigo-900/25",
    timelineBadge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    timelineToggle: "text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200",
  },
  vaccinations: {
    tabIconText: "text-teal-600 dark:text-teal-400",
    tabActiveState: "data-[state=active]:bg-teal-100 data-[state=active]:text-teal-700 dark:data-[state=active]:bg-teal-900/40 dark:data-[state=active]:text-teal-300",
    timelineStripeBg: "bg-teal-50 dark:bg-teal-900/25",
    timelineBadge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    timelineToggle: "text-teal-600 hover:text-teal-700 dark:text-teal-300 dark:hover:text-teal-200",
  },
  visits: {
    tabIconText: "text-blue-600 dark:text-blue-400",
    tabActiveState: "data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/40 dark:data-[state=active]:text-blue-300",
    timelineStripeBg: "bg-blue-50 dark:bg-blue-900/25",
    timelineBadge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    timelineToggle: "text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200",
  },
  reports: {
    tabIconText: "text-emerald-600 dark:text-emerald-400",
    tabActiveState: "data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/40 dark:data-[state=active]:text-emerald-300",
    timelineStripeBg: "bg-emerald-50 dark:bg-emerald-900/25",
    timelineBadge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    timelineToggle: "text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200",
  },
};

type TimelineEventColorKey =
  | "consultation"
  | "prescription"
  | "lab-test"
  | "imaging"
  | "follow-up"
  | "surgery"
  | "hospitalization"
  | "vaccination"
  | "appointment";

const EVENT_TO_MODULE_TAB: Record<TimelineEventColorKey, MedicalModuleTab> = {
  consultation: "visits",
  prescription: "medications",
  "lab-test": "tests",
  imaging: "tests",
  "follow-up": "visits",
  surgery: "surgeries",
  hospitalization: "hospitalizations",
  vaccination: "vaccinations",
  appointment: "visits",
};

export function getTimelineAccentByEventType(eventType: TimelineEventColorKey) {
  const tab = EVENT_TO_MODULE_TAB[eventType] ?? "visits";
  return MEDICAL_MODULE_TAB_ACCENTS[tab];
}
