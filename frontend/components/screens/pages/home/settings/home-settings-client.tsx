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
  Loader2,
  Languages,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { GoogleCalendarConnect } from "@/components/settings/google-calendar-connect";
import { changePassword } from "@/lib/auth-actions";
import { useLanguagePreference } from "@/components/providers/language-preference-provider";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import { Separator } from "@/components/ui/separator";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsItem } from "@/components/settings/SettingsItem";
import { supportedLocales } from "@/lib/locale-path";

type ThemeMode = "light" | "dark" | "system";
type SettingsRole = "patient" | "doctor" | "admin";

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

export default function SettingsPage({ role = "patient" }: { role?: SettingsRole }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { locale, setLocale } = useLanguagePreference();
  const tCommon = useTranslations("common");
  const tSettings = useTranslations("settings");

  const [settings, setSettings] = React.useState<SettingsState>(defaultSettings);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string>("");
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | "unsupported">("unsupported");

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
    patch: Partial<SettingsState[K]>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  };

  const handlePushToggle = async (checked: boolean) => {
    if (!checked) {
      setNestedSettings("notifications", { push: false });
      return;
    }

    if (!("Notification" in window)) {
      setSaveMessage(tSettings("messages.pushUnsupported"));
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
      setPasswordMessage({ type: "error", text: tSettings("password.validation.minLength") });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: tSettings("password.validation.mismatch") });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMessage({ type: "error", text: tSettings("password.validation.sameAsCurrent") });
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: tSettings("password.messages.success") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      const fallback = tSettings("password.messages.failure");
      const msg = err instanceof Error ? err.message : fallback;
      setPasswordMessage({ type: "error", text: msg });
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
    setSaveMessage(tSettings("messages.saved"));
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setTheme("system");
    setSaveMessage(tSettings("messages.reset"));
  };

  const roleTitle =
    role === "doctor"
      ? tSettings("page.titleDoctor")
      : role === "admin"
        ? tSettings("page.titleAdmin")
        : tSettings("page.titlePatient");

  const languageOptions = supportedLocales.map((optionLocale) => ({
    locale: optionLocale,
    label: optionLocale === "en" ? tCommon("english") : tCommon("bangla"),
    description:
      optionLocale === "en"
        ? tSettings("language.englishDescription")
        : tSettings("language.banglaDescription"),
  }));

  return (
    <SettingsLayout
      role={role}
      title={roleTitle}
      description={tSettings("page.description")}
      headerActions={
        <>
          <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
            {tSettings("actions.reset")}
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto" disabled={isSaving}>
            {isSaving ? <ButtonLoader className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSaving ? tSettings("actions.saving") : tSettings("actions.save")}
          </Button>
        </>
      }
    >
      {saveMessage && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary-more-light px-4 py-3 text-sm text-primary md:mb-8">
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <SettingsSection
          icon={<Sun className="h-5 w-5 text-primary" />}
          title={tSettings("appearance.title")}
          description={tSettings("appearance.description")}
        >
          <Button
            variant="medical"
            className="h-14 w-full rounded-2xl bg-linear-to-r from-primary to-primary-muted text-base font-semibold"
            onClick={() => setTheme(activeResolvedTheme === "dark" ? "light" : "dark")}
          >
            {activeResolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {activeResolvedTheme === "dark" ? tSettings("appearance.switchToLight") : tSettings("appearance.switchToDark")}
          </Button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ThemeModeButton
              label={tSettings("appearance.light")}
              value="light"
              active={currentTheme === "light"}
              onClick={setTheme}
              icon={<Sun className="h-4 w-4" />}
            />
            <ThemeModeButton
              label={tSettings("appearance.dark")}
              value="dark"
              active={currentTheme === "dark"}
              onClick={setTheme}
              icon={<Moon className="h-4 w-4" />}
            />
            <ThemeModeButton
              label={tSettings("appearance.system")}
              value="system"
              active={currentTheme === "system"}
              onClick={setTheme}
              icon={<Monitor className="h-4 w-4" />}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {tSettings("appearance.activeMode")}: <span className="font-semibold capitalize text-foreground">{activeResolvedTheme}</span>
          </p>
        </SettingsSection>

        <SettingsSection
          icon={<Languages className="h-5 w-5 text-primary" />}
          title={tCommon("language")}
          description={tSettings("language.description")}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {languageOptions.map((option) => {
              const isActive = locale === option.locale;

              return (
                <button
                  key={option.locale}
                  type="button"
                  onClick={() => setLocale(option.locale)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-surface"
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className={`mt-1 block text-xs ${isActive ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Bell className="h-5 w-5 text-primary" />}
          title={tSettings("notifications.title")}
          description={tSettings("notifications.description")}
          contentClassName="space-y-3"
        >
          <SettingsItem label={tSettings("notifications.inAppTitle")} description={tSettings("notifications.inAppDescription")} action={<Switch checked={settings.notifications.inApp} onCheckedChange={(checked) => setNestedSettings("notifications", { inApp: checked })} aria-label={tSettings("notifications.inAppTitle")} />} />
          <SettingsItem label={tSettings("notifications.pushTitle")} description={tSettings("notifications.pushDescription")} action={<Switch checked={settings.notifications.push} onCheckedChange={handlePushToggle} aria-label={tSettings("notifications.pushTitle")} />} />
          <SettingsItem label={tSettings("notifications.emailTitle")} description={tSettings("notifications.emailDescription")} action={<Switch checked={settings.notifications.email} onCheckedChange={(checked) => setNestedSettings("notifications", { email: checked })} aria-label={tSettings("notifications.emailTitle")} />} />
          <SettingsItem label={tSettings("notifications.smsTitle")} description={tSettings("notifications.smsDescription")} action={<Switch checked={settings.notifications.sms} onCheckedChange={(checked) => setNestedSettings("notifications", { sms: checked })} aria-label={tSettings("notifications.smsTitle")} />} />

          <Separator className="my-2" />

          <SettingsItem label={tSettings("notifications.appointmentTitle")} description={tSettings("notifications.appointmentDescription")} action={<Switch checked={settings.notifications.appointmentReminders} onCheckedChange={(checked) => setNestedSettings("notifications", { appointmentReminders: checked })} aria-label={tSettings("notifications.appointmentTitle")} />} />
          <SettingsItem label={tSettings("notifications.medicationTitle")} description={tSettings("notifications.medicationDescription")} action={<Switch checked={settings.notifications.medicationReminders} onCheckedChange={(checked) => setNestedSettings("notifications", { medicationReminders: checked })} aria-label={tSettings("notifications.medicationTitle")} />} />
          <SettingsItem label={tSettings("notifications.labTitle")} description={tSettings("notifications.labDescription")} action={<Switch checked={settings.notifications.labResults} onCheckedChange={(checked) => setNestedSettings("notifications", { labResults: checked })} aria-label={tSettings("notifications.labTitle")} />} />
          <SettingsItem label={tSettings("notifications.prescriptionTitle")} description={tSettings("notifications.prescriptionDescription")} action={<Switch checked={settings.notifications.prescriptionUpdates} onCheckedChange={(checked) => setNestedSettings("notifications", { prescriptionUpdates: checked })} aria-label={tSettings("notifications.prescriptionTitle")} />} />
          <SettingsItem label={tSettings("notifications.careTipsTitle")} description={tSettings("notifications.careTipsDescription")} action={<Switch checked={settings.notifications.careTips} onCheckedChange={(checked) => setNestedSettings("notifications", { careTips: checked })} aria-label={tSettings("notifications.careTipsTitle")} />} />

          <p className="text-xs text-muted-foreground">
            {tSettings("notifications.permissionLabel")}:{" "}
            <span className="font-semibold capitalize text-foreground">{notificationPermission}</span>
          </p>
        </SettingsSection>

        <SettingsSection
          icon={<HeartPulse className="h-5 w-5 text-primary" />}
          title={tSettings("healthcare.title")}
          description={tSettings("healthcare.description")}
        >
          <div className="space-y-2">
            <Label htmlFor="preferred-language">{tSettings("healthcare.preferredLanguage")}</Label>
            <Select
              id="preferred-language"
              value={settings.healthcare.preferredLanguage}
              onChange={(e) =>
                setNestedSettings("healthcare", {
                  preferredLanguage: e.target.value as SettingsState["healthcare"]["preferredLanguage"],
                })
              }
            >
              <option value="en">{tCommon("english")}</option>
              <option value="bn">{tCommon("bangla")}</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emergency-name">{tSettings("healthcare.emergencyName")}</Label>
              <Input
                id="emergency-name"
                placeholder={tSettings("healthcare.emergencyNamePlaceholder")}
                value={settings.healthcare.emergencyName}
                onChange={(e) => setNestedSettings("healthcare", { emergencyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-phone">{tSettings("healthcare.emergencyPhone")}</Label>
              <Input
                id="emergency-phone"
                placeholder={tSettings("healthcare.emergencyPhonePlaceholder")}
                value={settings.healthcare.emergencyPhone}
                onChange={(e) => setNestedSettings("healthcare", { emergencyPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-relation">{tSettings("healthcare.emergencyRelation")}</Label>
              <Input
                id="emergency-relation"
                placeholder={tSettings("healthcare.emergencyRelationPlaceholder")}
                value={settings.healthcare.emergencyRelation}
                onChange={(e) => setNestedSettings("healthcare", { emergencyRelation: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <SettingsItem label={tSettings("healthcare.dosageTitle")} description={tSettings("healthcare.dosageDescription")} action={<Switch checked={settings.healthcare.dosageAlerts} onCheckedChange={(checked) => setNestedSettings("healthcare", { dosageAlerts: checked })} aria-label={tSettings("healthcare.dosageTitle")} />} />
          <SettingsItem label={tSettings("healthcare.fastingTitle")} description={tSettings("healthcare.fastingDescription")} action={<Switch checked={settings.healthcare.fastingMedicationAlerts} onCheckedChange={(checked) => setNestedSettings("healthcare", { fastingMedicationAlerts: checked })} aria-label={tSettings("healthcare.fastingTitle")} />} />
          <SettingsItem label={tSettings("healthcare.hydrationTitle")} description={tSettings("healthcare.hydrationDescription")} action={<Switch checked={settings.healthcare.hydrationReminders} onCheckedChange={(checked) => setNestedSettings("healthcare", { hydrationReminders: checked })} aria-label={tSettings("healthcare.hydrationTitle")} />} />
          <SettingsItem label={tSettings("healthcare.menstrualTitle")} description={tSettings("healthcare.menstrualDescription")} action={<Switch checked={settings.healthcare.menstrualHealthReminders} onCheckedChange={(checked) => setNestedSettings("healthcare", { menstrualHealthReminders: checked })} aria-label={tSettings("healthcare.menstrualTitle")} />} />
        </SettingsSection>

        <SettingsSection
          icon={<Shield className="h-5 w-5 text-primary" />}
          title={tSettings("privacy.title")}
          description={tSettings("privacy.description")}
        >
          <SettingsItem label={tSettings("privacy.biometricTitle")} description={tSettings("privacy.biometricDescription")} action={<Switch checked={settings.privacy.biometricLock} onCheckedChange={(checked) => setNestedSettings("privacy", { biometricLock: checked })} aria-label={tSettings("privacy.biometricTitle")} />} />
          <SettingsItem label={tSettings("privacy.hideSensitiveTitle")} description={tSettings("privacy.hideSensitiveDescription")} action={<Switch checked={settings.privacy.hideSensitiveNotifications} onCheckedChange={(checked) => setNestedSettings("privacy", { hideSensitiveNotifications: checked })} aria-label={tSettings("privacy.hideSensitiveTitle")} />} />
          <SettingsItem label={tSettings("privacy.verifiedDoctorsTitle")} description={tSettings("privacy.verifiedDoctorsDescription")} action={<Switch checked={settings.privacy.shareWithVerifiedDoctorsOnly} onCheckedChange={(checked) => setNestedSettings("privacy", { shareWithVerifiedDoctorsOnly: checked })} aria-label={tSettings("privacy.verifiedDoctorsTitle")} />} />
          <SettingsItem label={tSettings("privacy.researchTitle")} description={tSettings("privacy.researchDescription")} action={<Switch checked={settings.privacy.shareAnonymousResearch} onCheckedChange={(checked) => setNestedSettings("privacy", { shareAnonymousResearch: checked })} aria-label={tSettings("privacy.researchTitle")} />} />

          <div className="space-y-2">
            <Label htmlFor="auto-lock">{tSettings("privacy.autoLock")}</Label>
            <Select
              id="auto-lock"
              value={settings.privacy.autoLockMinutes}
              onChange={(e) =>
                setNestedSettings("privacy", {
                  autoLockMinutes: e.target.value as SettingsState["privacy"]["autoLockMinutes"],
                })
              }
            >
              <option value="5">{tSettings("privacy.minutes5")}</option>
              <option value="15">{tSettings("privacy.minutes15")}</option>
              <option value="30">{tSettings("privacy.minutes30")}</option>
              <option value="60">{tSettings("privacy.minutes60")}</option>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smartphone className="h-4 w-4 text-primary" />
            {tSettings("appBehavior.title")}
          </div>

          <SettingsItem label={tSettings("appBehavior.compactTitle")} description={tSettings("appBehavior.compactDescription")} action={<Switch checked={settings.app.compactMode} onCheckedChange={(checked) => setNestedSettings("app", { compactMode: checked })} aria-label={tSettings("appBehavior.compactTitle")} />} />
          <SettingsItem label={tSettings("appBehavior.largeTextTitle")} description={tSettings("appBehavior.largeTextDescription")} action={<Switch checked={settings.app.largeText} onCheckedChange={(checked) => setNestedSettings("app", { largeText: checked })} aria-label={tSettings("appBehavior.largeTextTitle")} />} />
          <SettingsItem label={tSettings("appBehavior.reduceMotionTitle")} description={tSettings("appBehavior.reduceMotionDescription")} action={<Switch checked={settings.app.reduceMotion} onCheckedChange={(checked) => setNestedSettings("app", { reduceMotion: checked })} aria-label={tSettings("appBehavior.reduceMotionTitle")} />} />

          <div className="space-y-2">
            <Label htmlFor="start-page">{tSettings("appBehavior.defaultStartPage")}</Label>
            <Select
              id="start-page"
              value={settings.app.startPage}
              onChange={(e) =>
                setNestedSettings("app", {
                  startPage: e.target.value as SettingsState["app"]["startPage"],
                })
              }
            >
              <option value="home">{tSettings("appBehavior.home")}</option>
              <option value="appointments">{tSettings("appBehavior.appointments")}</option>
              <option value="medical-history">{tSettings("appBehavior.medicalHistory")}</option>
              <option value="reminders">{tSettings("appBehavior.reminders")}</option>
            </Select>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<KeyRound className="h-5 w-5 text-primary" />}
          title={tSettings("password.title")}
          description={tSettings("password.description")}
        >
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
              <Label htmlFor="current-password">{tSettings("password.current")}</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder={tSettings("password.currentPlaceholder")}
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
              <Label htmlFor="new-password">{tSettings("password.new")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder={tSettings("password.newPlaceholder")}
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
              <Label htmlFor="confirm-new-password">{tSettings("password.confirm")}</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder={tSettings("password.confirmPlaceholder")}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
              />
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="text-xs text-destructive">{tSettings("password.validation.mismatch")}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={passwordLoading}>
              {passwordLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tSettings("password.actions.changing")}
                </>
              ) : (
                tSettings("password.actions.change")
              )}
            </Button>
          </form>
        </SettingsSection>

        <GoogleCalendarConnect />
      </div>

      {!isHydrated && (
        <div className="mt-6 text-sm text-muted-foreground">{tSettings("messages.loading")}</div>
      )}
    </SettingsLayout>
  );
}
