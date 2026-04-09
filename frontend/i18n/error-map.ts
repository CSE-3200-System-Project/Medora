const ERROR_CODE_TO_KEY: Record<string, string> = {
  INVALID_TOKEN: "auth.invalidToken",
  ACCESS_DENIED: "auth.accessDenied",
  LOGIN_FAILED: "auth.loginFailed",
  NOTIFICATIONS_LOAD_FAILED: "notifications.loadFailed",
};

type ErrorTranslationInput = {
  code?: string | null;
  detail?: string | null;
  fallbackKey?: string;
};

export function resolveErrorKeyByCode(code?: string | null): string | null {
  if (!code) {
    return null;
  }
  return ERROR_CODE_TO_KEY[code] ?? null;
}

export function tError(
  tErrors: (key: string) => string,
  { code, detail, fallbackKey = "common.unexpected" }: ErrorTranslationInput
): string {
  const mappedKey = resolveErrorKeyByCode(code);
  if (mappedKey) {
    return tErrors(mappedKey);
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return tErrors(fallbackKey);
}

