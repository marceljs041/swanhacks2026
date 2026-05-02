import type { SupportedLanguage } from "../types/user-preferences";

export type LanguageDescriptor = {
  code: SupportedLanguage;
  label: string;
  englishLabel: string;
  isRTL: boolean;
  ttsLocale: string;
};

export const LANGUAGES: readonly LanguageDescriptor[] = [
  { code: "en", label: "English", englishLabel: "English", isRTL: false, ttsLocale: "en-US" },
  { code: "es", label: "Español", englishLabel: "Spanish", isRTL: false, ttsLocale: "es-ES" },
  { code: "ar", label: "العربية", englishLabel: "Arabic", isRTL: true, ttsLocale: "ar-SA" },
  {
    code: "zh",
    label: "简体中文",
    englishLabel: "Chinese (Simplified)",
    isRTL: false,
    ttsLocale: "zh-CN",
  },
] as const;

export const SUPPORTED_LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function getLanguageDescriptor(code: string): LanguageDescriptor {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguage);
}
