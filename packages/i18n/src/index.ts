import type { SupportedLanguage } from "@cyaccess/shared";
import en from "./locales/en.json";
import es from "./locales/es.json";
import ar from "./locales/ar.json";
import zh from "./locales/zh.json";

export const resources: Record<SupportedLanguage, { translation: Record<string, string> }> = {
  en: { translation: en as Record<string, string> },
  es: { translation: es as Record<string, string> },
  ar: { translation: ar as Record<string, string> },
  zh: { translation: zh as Record<string, string> },
};

export const FALLBACK_LANGUAGE: SupportedLanguage = "en";

export type TranslationKey = keyof typeof en;
