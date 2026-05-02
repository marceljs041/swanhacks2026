import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources, FALLBACK_LANGUAGE } from "@cyaccess/i18n";
import type { SupportedLanguage } from "@cyaccess/shared";

let initialized = false;

export function initI18n(language: SupportedLanguage) {
  if (initialized) {
    if (i18n.language !== language) i18n.changeLanguage(language);
    return i18n;
  }
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: FALLBACK_LANGUAGE,
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
    });
  initialized = true;
  return i18n;
}

export { i18n };
