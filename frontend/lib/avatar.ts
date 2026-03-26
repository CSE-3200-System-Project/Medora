const AVATAR_STYLES = [
  "adventurer",
  "avataaars",
  "bottts",
  "fun-emoji",
  "identicon",
  "lorelei",
  "micah",
  "personas",
] as const;

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function cleanSeed(seed: string): string {
  const cleaned = String(seed || "").replace(/[^a-zA-Z0-9_-]+/g, "");
  return cleaned.slice(0, 64) || "medora-user";
}

export function generateDefaultAvatarUrl(seed: string): string {
  const normalizedSeed = cleanSeed(seed);
  const style = AVATAR_STYLES[hashSeed(normalizedSeed) % AVATAR_STYLES.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(normalizedSeed)}`;
}

export function resolveAvatarUrl(preferredUrl?: string | null, fallbackSeed?: string): string {
  const trimmedPreferred = String(preferredUrl || "").trim();
  if (trimmedPreferred) {
    return trimmedPreferred;
  }
  return generateDefaultAvatarUrl(fallbackSeed || "medora-user");
}
