import { en } from "./en";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** Shape every language file must have. */
export type Messages = Widen<typeof en>;
export type Locale = "en";

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A dotted key into the messages, e.g. "auth.wrongPassword". Used by validation and action results. */
export type MessageKey = Paths<Messages>;

export type MessageVars = Record<string, string | number>;

const dictionaries: Record<Locale, Messages> = { en };

/** Messages for server components. Only English for now; Hindi will be chosen per user later. */
export function getMessages(locale: Locale = "en"): Messages {
  return dictionaries[locale];
}

/** Fills {placeholders}: format("Hi {name}", { name: "Ramesh" }) → "Hi Ramesh". */
export function format(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Looks up a dotted key. Unknown keys are returned as-is so a typo is visible, not blank. */
export function translate(messages: Messages, key: string, vars?: MessageVars): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof node === "string" ? format(node, vars) : key;
}
