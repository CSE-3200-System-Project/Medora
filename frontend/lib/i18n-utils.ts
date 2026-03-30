import enMessages from "@/messages/en.json";

type Primitive = string | number | boolean | null | undefined;

type NestedKeyOf<TObj extends Record<string, unknown>> = {
  [TKey in keyof TObj & string]: TObj[TKey] extends Primitive
    ? TKey
    : TObj[TKey] extends Array<unknown>
      ? TKey
      : `${TKey}.${NestedKeyOf<TObj[TKey] & Record<string, unknown>>}`;
}[keyof TObj & string];

export type MessageSchema = typeof enMessages;
export type MessageKey = NestedKeyOf<MessageSchema>;

export function tKey<TKey extends MessageKey>(key: TKey): TKey {
  return key;
}

export function mergeMessages<T extends Record<string, unknown>>(
  fallback: T,
  current: Partial<T>,
): T {
  const merged: Record<string, unknown> = {...fallback};

  for (const [key, value] of Object.entries(current)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      key in merged &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = mergeMessages(
        merged[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    merged[key] = value;
  }

  return merged as T;
}
