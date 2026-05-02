import { Redirect } from "expo-router";
import { usePreferences } from "../src/stores/preferences.store";

export default function Index() {
  const hasCompletedOnboarding = usePreferences((s) => s.hasCompletedOnboarding);
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding/language" />;
  return <Redirect href="/(tabs)/map" />;
}
