export const ADMIN_COOKIE_NAME = "admin_access";

const TOKEN_VERSION = "v1";
const TOKEN_MESSAGE = "medora-admin-access";

export function getAdminSecret(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fromHex(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(
    value.match(/.{2}/g) ?? [],
    (pair) => Number.parseInt(pair, 16),
  );
}

export async function createAdminAccessToken(secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(TOKEN_MESSAGE),
  );
  return `${TOKEN_VERSION}.${toHex(signature)}`;
}

export async function verifyAdminAccessToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  const [version, encodedSignature] = token.split(".", 2);
  if (version !== TOKEN_VERSION) return false;
  const signature = fromHex(encodedSignature);
  if (!signature) return false;

  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(TOKEN_MESSAGE),
  );
}

export async function verifyAdminPassword(
  candidate: string,
  secret: string,
): Promise<boolean> {
  if (!candidate || !secret) return false;
  const candidateToken = await createAdminAccessToken(candidate);
  return verifyAdminAccessToken(candidateToken, secret);
}
