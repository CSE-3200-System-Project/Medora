"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  Monitor,
  Bell,
  Shield,
  HeartPulse,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { ButtonLoader } from "@/components/ui/medora-loader";

import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Separator } from "@/components/ui/separator";

type ThemeMode = "light" | "dark" | "system";

type SettingsState = {
  notifications: {
    inApp: boolean;
    push: boolean;
    email: boolean;
    sms: boolean;
    appointmentReminders: boolean;
    medicationReminders: boolean;
    labResults: boolean;
    prescriptionUpdates: boolean;
    careTips: boolean;
  };
  healthcare: {
    emergencyName: string;
    emergencyPhone: string;
    emergencyRelation: string;
    preferredLanguage: "en" | "bn";
    dosageAlerts: boolean;
    fastingMedicationAlerts: boolean;
    hydrationReminders: boolean;
    menstrualHealthReminders: boolean;
  };
  privacy: {
    biometricLock: boolean;
    autoLockMinutes: "5" | "15" | "30" | "60";
    shareAnonymousResearch: boolean;
    shareWithVerifiedDoctorsOnly: boolean;
    hideSensitiveNotifications: boolean;
  };
  app: {
    compactMode: boolean;
    largeText: boolean;
    reduceMotion: boolean;
    startPage: "home" | "appointments" | "medical-history" | "reminders";
  };
};

const STORAGE_KEY = "medora.settings.v1";

const defaultSettings: SettingsState = {
  notifications: {
    inApp: true,
    push: false,
    email: true,
    sms: false,
    appointmentReminders: true,
    medicationReminders: true,
    labResults: true,
    prescriptionUpdates: true,
    careTips: false,
  },
  healthcare: {
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    preferredLanguage: "en",
    dosageAlerts: true,
    fastingMedicationAlerts: true,
    hydrationReminders: false,
    menstrualHealthReminders: false,
  },
  privacy: {
    biometricLock: false,
    autoLockMinutes: "15",
    shareAnonymousResearch: false,
    shareWithVerifiedDoctorsOnly: true,
    hideSensitiveNotifications: true,
  },
  app: {
    compactMode: false,
    largeText: false,
    reduceMotion: false,
    startPage: "home",
  },
};

function mergeSettings(value: unknown): SettingsState {
  if (!value || typeof value !== "object") {
    return defaultSettings;
  }

  const parsed = value as Partial<SettingsState>;

  return {
    notifications: {
      ...defaultSettings.notifications,
      ...(parsed.notifications ?? {}),
    },
    healthcare: {
      ...defaultSettings.healthcare,
      ...(parsed.healthcare ?? {}),
    },
    privacy: {
      ...defaultSettings.privacy,
      ...(parsed.privacy ?? {}),
    },
    app: {
      ...defaultSettings.app,
      ...(parsed.app ?? {}),
    },
  };
}

function ThemeModeButton({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: ThemeMode;
  active: boolean;
  onClick: (value: ThemeMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`
        min-h-12 w-full rounded-xl border px-3 py-3 text-left transition-all duration-200
        ${
          active
            ? "border-primary bg-primary text-primary-foreground shadow-md"
            : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-surface"
        }
      `}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
    </button>
  );
}

function SettingsToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="space-y-1 pr-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [settings, setSettings] = React.useState<SettingsState>(defaultSettings);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string>("");
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        setSettings(mergeSettings(parsed));
      }
    } catch {
      setSettings(defaultSettings);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  React.useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, isHydrated]);

  const currentTheme = (theme ?? "system") as ThemeMode;
  const activeResolvedTheme = resolvedTheme ?? "light";

  const setNestedSettings = <K extends keyof SettingsState>(
    section: K,
    patch: Partial<SettingsState[K]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  };

  const handleThemeChange = (value: ThemeMode) => {
    setTheme(value);
  };

  const handleThemeQuickToggle = () => {
    if (activeResolvedTheme === "dark") {
      setTheme("light");
      return;
    }
    setTheme("dark");
  };

  const handlePushToggle = async (checked: boolean) => {
    if (!checked) {
      setNestedSettings("notifications", { push: false });
      return;
    }

    if (!("Notification" in window)) {
      setSaveMessage("Push notifications are not supported in this browser.");
      return;
    }

    if (Notification.permission === "granted") {
      setNestedSettings("notifications", { push: true });
      setNotificationPermission("granted");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    setNestedSettings("notifications", { push: permission === "granted" });
    if (permission !== "granted") {
      setSaveMessage("Push permission is blocked. You can enable it from browser settings.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    await new Promise((resolve) => setTimeout(resolve, 500));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setIsSaving(false);
    setSaveMessage("Settings saved successfully.");
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setTheme("system");
    setSaveMessage("Settings reset to defaults.");
  };

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="mx-auto max-w-6xl py-8 pt-24 md:pt-28">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              Manage your app behavior, healthcare preferences, notifications, and privacy.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Reset Defaults
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving}>
              {isSaving ? <ButtonLoader className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>

        {saveMessage && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary-more-light px-4 py-3 text-sm text-primary md:mb-8">
            {saveMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sun className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Choose light, dark, or system mode. Theme changes apply instantly across Medora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="medical"
                className="h-14 w-full rounded-2xl bg-linear-to-r from-primary to-primary-muted text-base font-semibold"
                onClick={handleThemeQuickToggle}
              >
                {activeResolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                {activeResolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </Button>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ThemeModeButton
                  label="Light"
                  value="light"
                  active={currentTheme === "light"}
                  onClick={handleThemeChange}
                  icon={<Sun className="h-4 w-4" />}
                />
                <ThemeModeButton
                  label="Dark"
                  value="dark"
                  active={currentTheme === "dark"}
                  onClick={handleThemeChange}
                  icon={<Moon className="h-4 w-4" />}
                />
                <ThemeModeButton
                  label="System"
                  value="system"
                  active={currentTheme === "system"}
                  onClick={handleThemeChange}
                  icon={<Monitor className="h-4 w-4" />}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Active mode: <span className="font-semibold capitalize text-foreground">{activeResolvedTheme}</span>
              </p>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>
                Control how and when Medora sends medical reminders and care updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SettingsToggleRow
                title="In-App Notifications"
                description="Receive alerts in your Medora dashboard."
                checked={settings.notifications.inApp}
                onCheckedChange={(checked) => setNestedSettings("notifications", { inApp: checked })}
              />
              <SettingsToggleRow
                title="Push Notifications"
                description="Browser/device alerts for critical updates."
                checked={settings.notifications.push}
                onCheckedChange={handlePushToggle}
              />
              <SettingsToggleRow
                title="Email Notifications"
                description="Appointment and prescription updates by email."
                checked={settings.notifications.email}
                onCheckedChange={(checked) => setNestedSettings("notifications", { email: checked })}
              />
              <SettingsToggleRow
                title="SMS Notifications"
                description="Time-sensitive reminders via SMS."
                checked={settings.notifications.sms}
                onCheckedChange={(checked) => setNestedSettings("notifications", { sms: checked })}
              />

              <Separator className="my-2" />

              <SettingsToggleRow
                title="Appointment Reminders"
                description="Get reminders before your appointments."
                checked={settings.notifications.appointmentReminders}
                onCheckedChange={(checked) => setNestedSettings("notifications", { appointmentReminders: checked })}
              />
              <SettingsToggleRow
                title="Medication Reminders"
                description="Receive alerts for medication schedules."
                checked={settings.notifications.medicationReminders}
                onCheckedChange={(checked) => setNestedSettings("notifications", { medicationReminders: checked })}
              />
              <SettingsToggleRow
                title="Lab Results"
                description="Notify when test results are ready."
                checked={settings.notifications.labResults}
                onCheckedChange={(checked) => setNestedSettings("notifications", { labResults: checked })}
              />
              <SettingsToggleRow
                title="Prescription Updates"
                description="Status updates for newly issued prescriptions."
                checked={settings.notifications.prescriptionUpdates}
                onCheckedChange={(checked) => setNestedSettings("notifications", { prescriptionUpdates: checked })}
              />
              <SettingsToggleRow
                title="Health Care Tips"
                description="Personalized wellness and preventive care updates."
                checked={settings.notifications.careTips}
                onCheckedChange={(checked) => setNestedSettings("notifications", { careTips: checked })}
              />

              <p className="text-xs text-muted-foreground">
                Browser permission: <span className="font-semibold capitalize text-foreground">{notificationPermission}</span>
              </p>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HeartPulse className="h-5 w-5 text-primary" />
                Healthcare Preferences
              </CardTitle>
              <CardDescription>
                Keep emergency and care-related preferences ready for faster support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferred-language">Preferred Language</Label>
                <Select
                  id="preferred-language"
                  value={settings.healthcare.preferredLanguage}
                  onChange={(e) =>
                    setNestedSettings("healthcare", {
                      preferredLanguage: e.target.value as SettingsState["healthcare"]["preferredLanguage"],
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="bn">Bangla</option>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="emergency-name">Emergency Contact Name</Label>
                  <Input
                    id="emergency-name"
                    placeholder="Full name"
                    value={settings.healthcare.emergencyName}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-phone">Emergency Contact Phone</Label>
                  <Input
                    id="emergency-phone"
                    placeholder="01XXXXXXXXX"
                    value={settings.healthcare.emergencyPhone}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-relation">Relation</Label>
                  <Input
                    id="emergency-relation"
                    placeholder="Parent / Sibling / Spouse"
                    value={settings.healthcare.emergencyRelation}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyRelation: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <SettingsToggleRow
                title="Dosage Alerts"
                description="Extra alerts if medication is delayed."
                checked={settings.healthcare.dosageAlerts}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { dosageAlerts: checked })}
              />
              <SettingsToggleRow
                title="Fasting Medication Alerts"
                description="Reminder cues for before/after meal instructions."
                checked={settings.healthcare.fastingMedicationAlerts}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { fastingMedicationAlerts: checked })}
              />
              <SettingsToggleRow
                title="Hydration Reminders"
                description="Scheduled water intake reminders."
                checked={settings.healthcare.hydrationReminders}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { hydrationReminders: checked })}
              />
              <SettingsToggleRow
                title="Menstrual Health Reminders"
                description="Cycle and symptom logging reminder nudges."
                checked={settings.healthcare.menstrualHealthReminders}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { menstrualHealthReminders: checked })}
              />
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Privacy, Security & App
              </CardTitle>
              <CardDescription>
                Secure your account and tailor experience for readability and comfort.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsToggleRow
                title="Biometric App Lock"
                description="Require fingerprint/face unlock on supported devices."
                checked={settings.privacy.biometricLock}
                onCheckedChange={(checked) => setNestedSettings("privacy", { biometricLock: checked })}
              />
              <SettingsToggleRow
                title="Hide Sensitive Notification Content"
                description="Only show generic text on lock screen-style notifications."
                checked={settings.privacy.hideSensitiveNotifications}
                onCheckedChange={(checked) => setNestedSettings("privacy", { hideSensitiveNotifications: checked })}
              />
              <SettingsToggleRow
                title="Verified Doctors Access Only"
                description="Share profile data only with verified doctors."
                checked={settings.privacy.shareWithVerifiedDoctorsOnly}
                onCheckedChange={(checked) => setNestedSettings("privacy", { shareWithVerifiedDoctorsOnly: checked })}
              />
              <SettingsToggleRow
                title="Anonymous Research Contribution"
                description="Allow anonymized data for healthcare improvement studies."
                checked={settings.privacy.shareAnonymousResearch}
                onCheckedChange={(checked) => setNestedSettings("privacy", { shareAnonymousResearch: checked })}
              />

              <div className="space-y-2">
                <Label htmlFor="auto-lock">Auto-Lock Timeout</Label>
                <Select
                  id="auto-lock"
                  value={settings.privacy.autoLockMinutes}
                  onChange={(e) =>
                    setNestedSettings("privacy", {
                      autoLockMinutes: e.target.value as SettingsState["privacy"]["autoLockMinutes"],
                    })
                  }
                >
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4 text-primary" />
                App Behavior
              </div>

              <SettingsToggleRow
                title="Compact Mode"
                description="Reduce spacing to fit more content on one screen."
                checked={settings.app.compactMode}
                onCheckedChange={(checked) => setNestedSettings("app", { compactMode: checked })}
              />
              <SettingsToggleRow
                title="Large Text"
                description="Increase text size for better readability."
                checked={settings.app.largeText}
                onCheckedChange={(checked) => setNestedSettings("app", { largeText: checked })}
              />
              <SettingsToggleRow
                title="Reduce Motion"
                description="Limit non-essential animations."
                checked={settings.app.reduceMotion}
                onCheckedChange={(checked) => setNestedSettings("app", { reduceMotion: checked })}
              />

              <div className="space-y-2">
                <Label htmlFor="start-page">Default Start Page</Label>
                <Select
                  id="start-page"
                  value={settings.app.startPage}
                  onChange={(e) =>
                    setNestedSettings("app", {
                      startPage: e.target.value as SettingsState["app"]["startPage"],
                    })
                  }
                >
                  <option value="home">Home</option>
                  <option value="appointments">Appointments</option>
                  <option value="medical-history">Medical History</option>
                  <option value="reminders">Reminders</option>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isHydrated && (
          <div className="mt-6 text-sm text-muted-foreground">Loading your settings...</div>
        )}
      </main>
    </AppBackground>
  );
}
