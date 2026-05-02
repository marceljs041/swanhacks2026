import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { I18nManager } from "react-native";
import { getLanguageDescriptor } from "@cyaccess/shared";
import { i18n, initI18n } from "./i18n";
import { usePreferences } from "../stores/preferences.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const language = usePreferences((s) => s.language);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n(language);
    const desc = getLanguageDescriptor(language);
    if (I18nManager.isRTL !== desc.isRTL) {
      I18nManager.allowRTL(desc.isRTL);
      I18nManager.forceRTL(desc.isRTL);
    }
    setReady(true);
  }, [language]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}
