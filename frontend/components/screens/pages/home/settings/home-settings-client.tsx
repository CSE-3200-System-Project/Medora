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
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { GoogleCalendarConnect } from "@/components/settings/google-calendar-connect";
import { changePassword } from "@/lib/auth-actions";

import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Separator } from "@/components/ui/separator";
import { useAppI18n, useT } from "@/i18n/client";
import { PHASE_ONE_NAMESPACES } from "@/i18n/config";

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
  const { setLocale, isLocaleSwitching } = useAppI18n();
  const tCommon = useT("common");
  const tSettings = useT("settings");

  const [settings, setSettings] = React.useState<SettingsState>(defaultSettings);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string>("");
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");

  // Change password state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [passwordMessage, setPasswordMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handlePreferredLanguageChange = React.useCallback(
    (locale: SettingsState["healthcare"]["preferredLanguage"]) => {
      setNestedSettings("healthcare", { preferredLanguage: locale });
      void setLocale(locale, { requiredNamespaces: PHASE_ONE_NAMESPACES });
    },
    [setLocale]
  );

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
      setSaveMessage(tSettings("messages.pushNotSupported"));
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
      setSaveMessage(tSettings("messages.pushBlocked"));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: tSettings("messages.passwordTooShort") });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: tSettings("messages.passwordsMismatch") });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMessage({ type: "error", text: tSettings("messages.passwordMustDiffer") });
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: tSettings("messages.passwordChangedSuccess") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: tSettings("messages.passwordChangeFailed") });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    await new Promise((resolve) => setTimeout(resolve, 500));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setIsSaving(false);
    setSaveMessage(tSettings("messages.settingsSaved"));
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setTheme("system");
    setSaveMessage(tSettings("messages.settingsReset"));
  };

  if (!isHydrated) {
    return (
      <AppBackground className="container-padding animate-page-enter">
        <Navbar />
        <main className="mx-auto max-w-6xl py-8 pt-[var(--nav-content-offset)]">
          <PageLoadingShell label={tSettings("loadingLabel")} cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="mx-auto max-w-6xl py-8 pt-[var(--nav-content-offset)]">
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">{tSettings("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              {tSettings("pageSubtitle")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              {tSettings("resetDefaults")}
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving || isLocaleSwitching}>
              {isSaving ? <ButtonLoader className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSaving ? tSettings("savingButton") : tSettings("saveButton")}
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
                {tSettings("sections.appearance.title")}
              </CardTitle>
              <CardDescription>
                {tSettings("sections.appearance.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="medical"
                className="h-14 w-full rounded-2xl bg-linear-to-r from-primary to-primary-muted text-base font-semibold"
                onClick={handleThemeQuickToggle}
              >
                {activeResolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                {activeResolvedTheme === "dark" ? tSettings("sections.appearance.switchToLight") : tSettings("sections.appearance.switchToDark")}
              </Button>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ThemeModeButton
                  label={tSettings("sections.appearance.light")}
                  value="light"
                  active={currentTheme === "light"}
                  onClick={handleThemeChange}
                  icon={<Sun className="h-4 w-4" />}
                />
                <ThemeModeButton
                  label={tSettings("sections.appearance.dark")}
                  value="dark"
                  active={currentTheme === "dark"}
                  onClick={handleThemeChange}
                  icon={<Moon className="h-4 w-4" />}
                />
                <ThemeModeButton
                  label={tSettings("sections.appearance.system")}
                  value="system"
                  active={currentTheme === "system"}
                  onClick={handleThemeChange}
                  icon={<Monitor className="h-4 w-4" />}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {tSettings("sections.appearance.activeMode")}: <span className="font-semibold capitalize text-foreground">{activeResolvedTheme}</span>
              </p>

              <div className="space-y-2">
                <Label htmlFor="preferred-language">{tSettings("preferredLanguage")}</Label>
                <Select
                  id="preferred-language"
                  value={settings.healthcare.preferredLanguage}
                  onChange={(e) => handlePreferredLanguageChange(e.target.value as SettingsState["healthcare"]["preferredLanguage"])}
                  disabled={isLocaleSwitching}
                >
                  <option value="en">{tCommon("english")}</option>
                  <option value="bn">{tCommon("bangla")}</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                {tSettings("sections.notifications.title")}
              </CardTitle>
              <CardDescription>
                {tSettings("sections.notifications.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SettingsToggleRow
                title={tSettings("sections.notifications.inApp.title")}
                description={tSettings("sections.notifications.inApp.description")}
                checked={settings.notifications.inApp}
                onCheckedChange={(checked) => setNestedSettings("notifications", { inApp: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.push.title")}
                description={tSettings("sections.notifications.push.description")}
                checked={settings.notifications.push}
                onCheckedChange={handlePushToggle}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.email.title")}
                description={tSettings("sections.notifications.email.description")}
                checked={settings.notifications.email}
                onCheckedChange={(checked) => setNestedSettings("notifications", { email: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.sms.title")}
                description={tSettings("sections.notifications.sms.description")}
                checked={settings.notifications.sms}
                onCheckedChange={(checked) => setNestedSettings("notifications", { sms: checked })}
              />

              <Separator className="my-2" />

              <SettingsToggleRow
                title={tSettings("sections.notifications.appointmentReminders.title")}
                description={tSettings("sections.notifications.appointmentReminders.description")}
                checked={settings.notifications.appointmentReminders}
                onCheckedChange={(checked) => setNestedSettings("notifications", { appointmentReminders: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.medicationReminders.title")}
                description={tSettings("sections.notifications.medicationReminders.description")}
                checked={settings.notifications.medicationReminders}
                onCheckedChange={(checked) => setNestedSettings("notifications", { medicationReminders: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.labResults.title")}
                description={tSettings("sections.notifications.labResults.description")}
                checked={settings.notifications.labResults}
                onCheckedChange={(checked) => setNestedSettings("notifications", { labResults: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.prescriptionUpdates.title")}
                description={tSettings("sections.notifications.prescriptionUpdates.description")}
                checked={settings.notifications.prescriptionUpdates}
                onCheckedChange={(checked) => setNestedSettings("notifications", { prescriptionUpdates: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.notifications.careTips.title")}
                description={tSettings("sections.notifications.careTips.description")}
                checked={settings.notifications.careTips}
                onCheckedChange={(checked) => setNestedSettings("notifications", { careTips: checked })}
              />

              <p className="text-xs text-muted-foreground">
                {tSettings("sections.notifications.browserPermission")}: <span className="font-semibold capitalize text-foreground">{notificationPermission}</span>
              </p>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HeartPulse className="h-5 w-5 text-primary" />
                {tSettings("sections.healthcare.title")}
              </CardTitle>
              <CardDescription>
                {tSettings("sections.healthcare.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="emergency-name">{tSettings("sections.healthcare.emergencyContactName")}</Label>
                  <Input
                    id="emergency-name"
                    placeholder={tSettings("sections.healthcare.emergencyContactNamePlaceholder")}
                    value={settings.healthcare.emergencyName}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-phone">{tSettings("sections.healthcare.emergencyContactPhone")}</Label>
                  <Input
                    id="emergency-phone"
                    placeholder={tSettings("sections.healthcare.emergencyContactPhonePlaceholder")}
                    value={settings.healthcare.emergencyPhone}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-relation">{tSettings("sections.healthcare.relation")}</Label>
                  <Input
                    id="emergency-relation"
                    placeholder={tSettings("sections.healthcare.relationPlaceholder")}
                    value={settings.healthcare.emergencyRelation}
                    onChange={(e) => setNestedSettings("healthcare", { emergencyRelation: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <SettingsToggleRow
                title={tSettings("sections.healthcare.dosageAlerts.title")}
                description={tSettings("sections.healthcare.dosageAlerts.description")}
                checked={settings.healthcare.dosageAlerts}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { dosageAlerts: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.healthcare.fastingMedicationAlerts.title")}
                description={tSettings("sections.healthcare.fastingMedicationAlerts.description")}
                checked={settings.healthcare.fastingMedicationAlerts}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { fastingMedicationAlerts: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.healthcare.hydrationReminders.title")}
                description={tSettings("sections.healthcare.hydrationReminders.description")}
                checked={settings.healthcare.hydrationReminders}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { hydrationReminders: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.healthcare.menstrualHealthReminders.title")}
                description={tSettings("sections.healthcare.menstrualHealthReminders.description")}
                checked={settings.healthcare.menstrualHealthReminders}
                onCheckedChange={(checked) => setNestedSettings("healthcare", { menstrualHealthReminders: checked })}
              />
            </CardContent>
          </Card>

          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {tSettings("sections.privacyAndApp.title")}
              </CardTitle>
              <CardDescription>
                {tSettings("sections.privacyAndApp.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.biometricLock.title")}
                description={tSettings("sections.privacyAndApp.biometricLock.description")}
                checked={settings.privacy.biometricLock}
                onCheckedChange={(checked) => setNestedSettings("privacy", { biometricLock: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.hideSensitiveContent.title")}
                description={tSettings("sections.privacyAndApp.hideSensitiveContent.description")}
                checked={settings.privacy.hideSensitiveNotifications}
                onCheckedChange={(checked) => setNestedSettings("privacy", { hideSensitiveNotifications: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.verifiedDoctorsOnly.title")}
                description={tSettings("sections.privacyAndApp.verifiedDoctorsOnly.description")}
                checked={settings.privacy.shareWithVerifiedDoctorsOnly}
                onCheckedChange={(checked) => setNestedSettings("privacy", { shareWithVerifiedDoctorsOnly: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.anonymousResearch.title")}
                description={tSettings("sections.privacyAndApp.anonymousResearch.description")}
                checked={settings.privacy.shareAnonymousResearch}
                onCheckedChange={(checked) => setNestedSettings("privacy", { shareAnonymousResearch: checked })}
              />

              <div className="space-y-2">
                <Label htmlFor="auto-lock">{tSettings("sections.privacyAndApp.autoLockTimeout")}</Label>
                <Select
                  id="auto-lock"
                  value={settings.privacy.autoLockMinutes}
                  onChange={(e) =>
                    setNestedSettings("privacy", {
                      autoLockMinutes: e.target.value as SettingsState["privacy"]["autoLockMinutes"],
                    })
                  }
                >
                  <option value="5">{tSettings("sections.privacyAndApp.autoLockOptions.five")}</option>
                  <option value="15">{tSettings("sections.privacyAndApp.autoLockOptions.fifteen")}</option>
                  <option value="30">{tSettings("sections.privacyAndApp.autoLockOptions.thirty")}</option>
                  <option value="60">{tSettings("sections.privacyAndApp.autoLockOptions.sixty")}</option>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Smartphone className="h-4 w-4 text-primary" />
                {tSettings("sections.privacyAndApp.appBehavior")}
              </div>

              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.compactMode.title")}
                description={tSettings("sections.privacyAndApp.compactMode.description")}
                checked={settings.app.compactMode}
                onCheckedChange={(checked) => setNestedSettings("app", { compactMode: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.largeText.title")}
                description={tSettings("sections.privacyAndApp.largeText.description")}
                checked={settings.app.largeText}
                onCheckedChange={(checked) => setNestedSettings("app", { largeText: checked })}
              />
              <SettingsToggleRow
                title={tSettings("sections.privacyAndApp.reduceMotion.title")}
                description={tSettings("sections.privacyAndApp.reduceMotion.description")}
                checked={settings.app.reduceMotion}
                onCheckedChange={(checked) => setNestedSettings("app", { reduceMotion: checked })}
              />

              <div className="space-y-2">
                <Label htmlFor="start-page">{tSettings("sections.privacyAndApp.defaultStartPage")}</Label>
                <Select
                  id="start-page"
                  value={settings.app.startPage}
                  onChange={(e) =>
                    setNestedSettings("app", {
                      startPage: e.target.value as SettingsState["app"]["startPage"],
                    })
                  }
                >
                  <option value="home">{tSettings("sections.privacyAndApp.startPageOptions.home")}</option>
                  <option value="appointments">{tSettings("sections.privacyAndApp.startPageOptions.appointments")}</option>
                  <option value="medical-history">{tSettings("sections.privacyAndApp.startPageOptions.medicalHistory")}</option>
                  <option value="reminders">{tSettings("sections.privacyAndApp.startPageOptions.reminders")}</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card hoverable>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="h-5 w-5 text-primary" />
                {tSettings("sections.password.title")}
              </CardTitle>
              <CardDescription>
                {tSettings("sections.password.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      passwordMessage.type === "success"
                        ? "border-success/30 bg-success/10 text-success-muted"
                        : "border-destructive/20 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {passwordMessage.text}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="current-password">{tSettings("sections.password.currentPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder={tSettings("sections.password.currentPasswordPlaceholder")}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">{tSettings("sections.password.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder={tSettings("sections.password.newPasswordPlaceholder")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">{tSettings("sections.password.confirmNewPassword")}</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder={tSettings("sections.password.confirmNewPasswordPlaceholder")}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="text-xs text-destructive">{tSettings("sections.password.passwordsDoNotMatch")}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={passwordLoading}>
                  {passwordLoading ? (
                    <>
                      <ButtonLoader className="h-4 w-4 mr-2" />
                      {tSettings("sections.password.changingPassword")}
                    </>
                  ) : (
                    tSettings("sections.password.changePassword")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Google Calendar Integration */}
          <GoogleCalendarConnect />
        </div>
      </main>
    </AppBackground>
  );
}
