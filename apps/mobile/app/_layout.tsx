import "../global.css";
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "../src/lib/providers";
import { usePreferences } from "../src/stores/preferences.store";
import { getDeviceId } from "../src/lib/device";

function RouteGuard() {
  const hasCompletedOnboarding = usePreferences((s) => s.hasCompletedOnboarding);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Make sure the device ID is created before any API call fires.
    getDeviceId().catch(() => {});
  }, []);

  useEffect(() => {
    const inOnboarding = segments[0] === "onboarding";
    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace("/onboarding/language");
    } else if (hasCompletedOnboarding && inOnboarding) {
      router.replace("/(tabs)/map");
    }
  }, [hasCompletedOnboarding, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <BottomSheetModalProvider>
            <RouteGuard />
            <StatusBar style="dark" />
          </BottomSheetModalProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
