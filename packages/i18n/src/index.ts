import en from "./locales/en.json" with { type: "json" };
import es from "./locales/es.json" with { type: "json" };
import ar from "./locales/ar.json" with { type: "json" };
import zh from "./locales/zh.json" with { type: "json" };

export const SUPPORTED_LOCALES = ["en", "es", "ar", "zh"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: Set<Locale> = new Set(["ar"]);

const dictionaries: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  ar: ar as Record<string, string>,
  zh: zh as Record<string, string>,
};

export type TranslationKey = keyof typeof en;

export function t(locale: Locale, key: TranslationKey | string): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key as string] ?? key;
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export function makeT(locale: Locale): (k: TranslationKey | string) => string {
  return (k) => t(locale, k);
}
